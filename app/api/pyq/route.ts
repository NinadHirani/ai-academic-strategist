import { NextRequest, NextResponse } from "next/server";
import { getPYQStore, PYQ, seedSamplePYQs } from "@/lib/pyq-store";
import { generatePYQInsights, analyzeUnits, analyzeTopics, analyzeYears, analyzeMarksDistribution } from "@/lib/pyq-analyzer";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initialize PYQ store with sample data if empty
 */
async function initializePYQStore() {
  const store = getPYQStore();
  const stats = await store.getStats();
  
  if (stats.totalQuestions === 0) {
    await seedSamplePYQs(store);
  }
  
  return store;
}

// ============================================================================
// GET - Retrieve PYQs and insights
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const subject = searchParams.get("subject");
    const unit = searchParams.get("unit");
    const topic = searchParams.get("topic");
    const year = searchParams.get("year");

    // Initialize store with sample data if needed
    const store = await initializePYQStore();

    // Handle different actions
    switch (action) {
      case "insights":
        // Generate comprehensive insights
        const insights = await generatePYQInsights(store, subject ? { subject } : undefined);
        return NextResponse.json({ success: true, insights });

      case "units":
        // Get units for a subject
        if (!subject) {
          return NextResponse.json({ error: "Subject is required" }, { status: 400 });
        }
        const units = await store.getUnits(subject);
        return NextResponse.json({ success: true, units });

      case "topics":
        // Get topics for a subject
        if (!subject) {
          return NextResponse.json({ error: "Subject is required" }, { status: 400 });
        }
        const topics = await store.getTopics(subject);
        return NextResponse.json({ success: true, topics });

      case "subjects":
        // Get all subjects
        const subjects = await store.getSubjects();
        return NextResponse.json({ success: true, subjects });

      case "years":
        // Get available years
        const years = await store.getYears();
        return NextResponse.json({ success: true, years });

      case "analyze-units":
        // Unit frequency analysis
        const unitAnalysis = await analyzeUnits(store, subject ? { subject } : undefined);
        return NextResponse.json({ success: true, units: unitAnalysis });

      case "analyze-topics":
        // Topic frequency analysis
        const topicAnalysis = await analyzeTopics(store, { subject: subject || undefined, unit: unit || undefined });
        return NextResponse.json({ success: true, topics: topicAnalysis });

      case "analyze-years":
        // Year-wise analysis
        const yearAnalysis = await analyzeYears(store, { subject: subject || undefined });
        return NextResponse.json({ success: true, years: yearAnalysis });

      case "marks-distribution":
        // Marks distribution analysis
        const marksDist = await analyzeMarksDistribution(store, subject ? { subject } : undefined);
        return NextResponse.json({ success: true, distribution: marksDist });

      case "stats":
        // Get overall statistics
        const stats = await store.getStats();
        return NextResponse.json({ success: true, stats });

      default:
        // Default: get filtered questions or all questions
        const filters: {
          subject?: string;
          unit?: string;
          topic?: string;
          year?: number;
        } = {};

        if (subject) filters.subject = subject;
        if (unit) filters.unit = unit;
        if (topic) filters.topic = topic;
        if (year) filters.year = parseInt(year);

        const questions = Object.keys(filters).length > 0 
          ? await store.getFiltered(filters)
          : await store.getAll();

        return NextResponse.json({ 
          success: true, 
          count: questions.length,
          questions 
        });
    }
  } catch (error) {
    console.error("[PYQ API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add new PYQs
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = getPYQStore();

    // Handle bulk import or single question
    if (Array.isArray(body.questions)) {
      // Bulk import
      const addedQuestions = await store.addMany(body.questions);
      return NextResponse.json({
        success: true,
        count: addedQuestions.length,
        questions: addedQuestions,
      });
    } else if (body.question) {
      // Single question
      const addedQuestion = await store.add(body.question);
      return NextResponse.json({
        success: true,
        question: addedQuestion,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid request: provide 'question' or 'questions' array" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[PYQ API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update a PYQ
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const store = getPYQStore();

    const updated = await store.update(id, body);
    
    if (!updated) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      question: updated,
    });
  } catch (error) {
    console.error("[PYQ API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete a PYQ
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");

    const store = getPYQStore();

    if (clearAll === "true") {
      // Clear all PYQs
      await store.clear();
      return NextResponse.json({ success: true, message: "All PYQs cleared" });
    }

    if (!id) {
      return NextResponse.json({ error: "Question ID is required" }, { status: 400 });
    }

    const deleted = await store.delete(id);
    
    if (!deleted) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Question deleted",
    });
  } catch (error) {
    console.error("[PYQ API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

