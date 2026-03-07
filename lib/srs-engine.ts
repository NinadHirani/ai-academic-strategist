import { supabase } from './supabase';

/**
 * SuperMemo-2 (SM-2) Algorithm implementation for Spaced Repetition
 */

export interface SRSItem {
    id?: string;
    user_id: string;
    topic_id: string;
    topic_name: string;
    interval: number;
    repetition: number;
    ease_factor: number;
    next_review_date: string;
}

/**
 * Process review feedback and calculate the next review interval using SM-2
 * @param userId - User ID
 * @param topicId - Topic ID
 * @param topicName - Topic name (for display)
 * @param quality - User's self-assessed quality of recall (0-5)
 *  0: Complete blackout
 *  1: Incorrect response; remembered correct after seeing it
 *  2: Incorrect response; seemed easy to recall
 *  3: Correct response recalled with serious difficulty
 *  4: Correct response after hesitation
 *  5: Perfect response
 */
export async function processReviewFeedback(
    userId: string,
    topicId: string,
    topicName: string,
    quality: number
) {
    try {
        // 1. Get existing item or create new default values
        const { data: existingItem, error } = await supabase
            .from('srs_items')
            .select('*')
            .eq('user_id', userId)
            .eq('topic_id', topicId)
            .single();

        let repetition = existingItem ? existingItem.repetition : 0;
        let easeFactor = existingItem ? existingItem.ease_factor : 2.5;
        let interval = existingItem ? existingItem.interval : 0;

        // 2. SM-2 Algorithm calculations
        if (quality >= 3) {
            if (repetition === 0) {
                interval = 1;
            } else if (repetition === 1) {
                interval = 6;
            } else {
                interval = Math.round(interval * easeFactor);
            }
            repetition += 1;
        } else {
            repetition = 0;
            interval = 1;
        }

        // Update ease factor (must be >= 1.3)
        easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (easeFactor < 1.3) {
            easeFactor = 1.3;
        }

        // Calculate next review date
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        // 3. Upsert into database
        const srsData = {
            user_id: userId,
            topic_id: topicId,
            topic_name: topicName,
            interval,
            repetition,
            ease_factor: easeFactor,
            next_review_date: nextReviewDate.toISOString(),
        };

        if (existingItem) {
            await supabase
                .from('srs_items')
                .update(srsData)
                .eq('id', existingItem.id);
        } else {
            await supabase
                .from('srs_items')
                .insert(srsData);
        }

        return srsData;
    } catch (error) {
        console.error('Error processing review feedback:', error);
        return null;
    }
}

/**
 * Get all items that are due for review today or earlier
 */
export async function getDueReviews(userId: string) {
    try {
        const today = new Date().toISOString();

        const { data, error } = await supabase
            .from('srs_items')
            .select('*')
            .eq('user_id', userId)
            .lte('next_review_date', today)
            .order('next_review_date', { ascending: true });

        if (error) throw error;

        return data as SRSItem[];
    } catch (error) {
        console.error('Error getting due reviews:', error);
        return [];
    }
}
