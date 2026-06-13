// Shared types used by both the API route (server) and results page (client).
// Keeping this in lib/types.ts prevents the client bundle from accidentally
// importing the API route module (which pulls in pdf-parse -> pdfjs-dist ->
// pdf.worker.js) and crashing with a client-side exception.

// -- API Response Contract -----------------------------------------------------

export type APIErrorCode =
  | 'NO_FILE'
  | 'INVALID_PDF'
  | 'PDF_ENCRYPTED'
  | 'PARSE_FAILED'
  | 'PARSER_UNAVAILABLE'
  | 'AI_FAILED'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export type ErrorResponse = {
  ok: false;
  mode: 'error';
  error: string;
  code: APIErrorCode;
};

export type ExtractionResponse = {
  ok: true;
  mode: 'extraction';
  full_text_length: number;
  preview_text: string;
  truncated: false;
  elapsed_ms: number;
};

export type AnalysisResponse = {
  ok: true;
  mode: 'analysis';
  full_text_length: number;
  preview_text: string;
  truncated: boolean;
  elapsed_ms: number;
  analysis: AnalysisResult;
};

export type APIResponse = ExtractionResponse | AnalysisResponse | ErrorResponse;

// -- Red Flag -----------------------------------------------------------------
// A string is not enough - severity drives UI priority and score caps.
// Critical = immediate rejection trigger. High = strong disadvantage. Medium = notable gap.

export interface RedFlag {
  flag: string;
  severity: 'Critical' | 'High' | 'Medium';
  impact: string;
}

// -- Dimension Scores ---------------------------------------------------------

export interface DimensionScores {
  technical_depth:       number;
  project_impact:        number;
  experience_relevance:  number;
  ats_compatibility:     number;
  narrative_clarity:     number;
  completeness:          number;
}

// -- Hiring Prediction --------------------------------------------------------

export interface HiringPrediction {
  outcome: 'Strong' | 'Possible' | 'Unlikely' | 'No';
  screen_pass_rate: number;
  competitive_tier: 'FAANG' | 'Top-50' | 'Mid-Market' | 'Startup-Only' | 'Not-Ready';
  verdict: string;
}

// -- Resume Tier --------------------------------------------------------------
// Gamified grade derived from final_score in normalize.ts - never AI-generated.
// S=90-100, A=75-89, B=60-74, C=45-59, D=30-44, F=0-29

export type ResumeTier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

// -- Analysis Result ----------------------------------------------------------

export interface AnalysisResult {
  // Role detection
  detected_role: string;
  role_confidence: number;
  is_career_pivot: boolean;

  // Gamified tier - derived from final_score, never from AI
  tier: ResumeTier;

  // Hiring outcome
  hiring_prediction: HiringPrediction;

  // Scores
  final_score: number;
  dimension_scores: DimensionScores;

  // Kept for backward compat with ScoreBar components
  content_score: number;
  ats_score: number;

  has_metrics: boolean;
  profile_strength: 'Weak' | 'Average' | 'Good' | 'Strong';
  summary: string;

  red_flags: RedFlag[];

  strengths: string[];
  issues: string[];
  action_plan: string[];
  top_priority: string;

  skills_analysis: {
    strong_skills: string[];
    weak_skills: string[];
    missing_skills: string[];
  };

  project_analysis: string;
  experience_analysis: string;

  ats_breakdown: {
    parsing_risk: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
    keyword_density: 'None' | 'Low' | 'Adequate' | 'Strong';
    formatting_issues: string[];
    missing_keywords: string[];
    ats_verdict: string;
  };

  upgrade_insight: {
    action: string;
    expected_score_increase: number;
    reason: string;
  };

  competitive_position: string;

  // Roast - AI-generated, specific to this resume. 60% savage wit, 40% cold truth.
  roast_headline: string;
  roast_body: string;
}
