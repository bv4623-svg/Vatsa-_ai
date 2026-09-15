"""
INTENT CATALOG DATA
Structured data extracted from: Intent Catalog - AI Router System v1.0

This module ONLY defines structured intent data (keywords, example queries,
related intents, scope). It performs no classification itself — see
classifier.py for that.
"""

INTENTS = {
    "PROGRAMMING": {
        "description": "User requests assistance with software development, coding, algorithms, or programming concepts across any language or framework.",
        "keywords": [
            "code", "program", "function", "class", "variable", "algorithm", "syntax",
            "framework", "library", "api", "backend", "frontend", "database", "sql",
            "javascript", "python", "java", "c++", "react", "node.js", "docker",
            "kubernetes", "microservices", "oop", "functional programming",
            "design pattern", "refactor", "optimize", "typescript", "graphql"
        ],
        "examples": [
            "Write a Python function to sort a list",
            "How do I implement a binary tree in Java?",
            "Explain REST API best practices",
            "Show me how to use React hooks",
            "Write a SQL query to join three tables",
            "How to optimize this JavaScript loop?",
            "Write a Dockerfile for a Python app",
            "How to use generics in TypeScript?",
            "How to structure a microservices architecture?",
            "Write a unit test for this function",
        ],
        "related_intents": ["CODING_DEBUGGING", "DATA_ANALYSIS", "MATHEMATICS", "RESEARCH", "AUTOMATION"],
    },
    "CODING_DEBUGGING": {
        "description": "User provides problematic code, error messages, or bug reports requiring diagnosis, error resolution, or troubleshooting guidance.",
        "keywords": [
            "bug", "error", "fix", "debug", "crash", "exception", "wrong", "issue",
            "problem", "broken", "not working", "failed", "invalid", "undefined",
            "null", "typeerror", "referenceerror", "404", "500", "stack trace",
            "logger", "exception handling", "breakpoint"
        ],
        "examples": [
            "This Python code is throwing a TypeError",
            "Why is my React component not rendering?",
            "Fix this SQL query - it says syntax error",
            "My Node.js app crashes with 'Out of Memory'",
            "Help me debug this infinite loop",
            "I'm getting a 404 error on my API endpoint",
            "This function returns None instead of the expected value",
            "My Docker container fails to start",
            "The API returns 500 errors intermittently",
            "Why is this variable undefined?",
        ],
        "related_intents": ["PROGRAMMING", "GENERAL_QUESTION_ANSWERING", "DATA_ANALYSIS"],
    },
    "RESEARCH": {
        "description": "User seeks comprehensive information, literature review, academic research, fact-finding, or deep dives into specific topics.",
        "keywords": [
            "research", "study", "literature", "science", "academic", "theory",
            "find", "discover", "investigate", "explore", "analyze", "evidence",
            "data", "publication", "journal", "paper", "findings", "report",
            "peer-reviewed", "scientific"
        ],
        "examples": [
            "Find recent studies on climate change impacts",
            "Research the history of artificial intelligence",
            "What are the latest developments in quantum computing?",
            "Find case studies on sustainable agriculture",
            "What does literature say about remote work productivity?",
            "Find market research on electric vehicles",
            "What are the competing theories in linguistics?",
            "Find clinical trials for Alzheimer's treatment",
            "What are the leading theories on consciousness?",
            "Research the impact of COVID-19 on education",
        ],
        "related_intents": ["GENERAL_QUESTION_ANSWERING", "DATA_ANALYSIS", "WRITING", "EDUCATION"],
    },
    "WRITING": {
        "description": "User needs assistance creating, editing, or improving written content across various formats, styles, and purposes.",
        "keywords": [
            "write", "content", "edit", "revise", "draft", "essay", "article",
            "story", "novel", "poem", "script", "email", "letter", "proposal",
            "blog", "proofread", "grammar", "style", "tone", "narrative", "dialogue"
        ],
        "examples": [
            "Write a professional cover letter",
            "Help me write a poem about nature",
            "Edit this essay for grammar and clarity",
            "Write a product description for my new app",
            "Create a blog post about sustainable living",
            "Develop a character backstory for my novel",
            "Write a persuasive argument for recycling",
            "Create a press release for my startup",
            "Write a short story about time travel",
            "Help me write a speech about climate action",
        ],
        "related_intents": ["RESEARCH", "DOCUMENT_CREATION", "PRESENTATION_CREATION", "BRAINSTORMING", "TRANSLATION"],
    },
    "MATHEMATICS": {
        "description": "User needs mathematical calculations, formulas, derivations, proofs, or concept explanations across all math domains.",
        "keywords": [
            "calculate", "solve", "equation", "formula", "math", "derivative",
            "integral", "probability", "statistics", "matrix", "algebra",
            "calculus", "theorem", "proof", "sum", "multiply", "divide",
            "percentage", "fraction", "decimal", "graph", "function"
        ],
        "examples": [
            "Solve this differential equation: dy/dx = 2x",
            "Calculate the derivative of x²sin(x)",
            "What's the probability of rolling two sixes?",
            "Find the determinant of this 3x3 matrix",
            "Solve this quadratic equation",
            "Calculate the integral of ln(x) dx",
            "Find the eigenvalues of this matrix",
            "What's the standard deviation of this dataset?",
            "Find the Taylor series expansion",
            "Solve this recurrence relation",
        ],
        "related_intents": ["DATA_ANALYSIS", "PROGRAMMING", "RESEARCH", "FINANCE", "EDUCATION"],
    },
    "EDUCATION": {
        "description": "User requests learning resources, tutorials, explanations, teaching strategies, or educational guidance on any subject.",
        "keywords": [
            "teach", "learn", "explain", "understand", "student", "lesson",
            "education", "school", "class", "curriculum", "study", "tutor",
            "beginner", "tutorial", "resource", "guide", "teaching", "pedagogy",
            "classroom", "homework", "grade"
        ],
        "examples": [
            "Explain the water cycle to a 5th grader",
            "What's the best way to teach fractions?",
            "Create a study plan for finals week",
            "Explain photosynthesis in simple terms",
            "Teach me the basics of chemistry",
            "Create a lesson plan on world geography",
            "What are the best learning resources for physics?",
            "Create a syllabus for a coding bootcamp",
            "What's the Socratic method?",
            "How do I accommodate different learning styles?",
        ],
        "related_intents": ["RESEARCH", "WRITING", "GENERAL_QUESTION_ANSWERING", "MATHEMATICS", "PROGRAMMING"],
    },
    "BUSINESS": {
        "description": "User requests business-related advice, strategy, planning, or guidance across any business domain.",
        "keywords": [
            "business", "strategy", "company", "entrepreneur", "startup",
            "management", "operations", "supply chain", "hr", "planning",
            "development", "scale", "growth", "kpi", "swot", "stakeholder",
            "innovation", "risk", "governance", "leadership"
        ],
        "examples": [
            "Create a business plan for a coffee shop",
            "What's the best company structure for a startup?",
            "Help me develop a go-to-market strategy",
            "How do I manage a remote team effectively?",
            "What are the key performance indicators for a SaaS business?",
            "How do I scale my small business?",
            "Create a SWOT analysis for my company",
            "What's a lean startup methodology?",
            "How do I build a business culture?",
            "Create a risk management framework",
        ],
        "related_intents": ["FINANCE", "MARKETING", "LEGAL", "DATA_ANALYSIS", "PLANNING"],
    },
    "FINANCE": {
        "description": "User requests financial calculations, investment advice, budgeting, accounting, or financial planning guidance.",
        "keywords": [
            "money", "finance", "investment", "budget", "tax", "accounting",
            "stock", "bond", "portfolio", "roi", "retirement", "mortgage",
            "interest", "savings", "crypto", "wealth", "fund", "asset",
            "liability", "cash flow", "profit", "loss", "revenue", "expense"
        ],
        "examples": [
            "Calculate the ROI for this investment",
            "Create a monthly budget for a family of four",
            "What's the best way to invest $10,000?",
            "Explain compound interest",
            "Calculate my retirement savings needs",
            "Help me understand cryptocurrency",
            "Create a financial model for my startup",
            "Calculate NPV and IRR for this project",
            "Help me build a diversified investment portfolio",
            "What's the difference between traditional and Roth IRA?",
        ],
        "related_intents": ["BUSINESS", "MATHEMATICS", "DATA_ANALYSIS", "LEGAL", "PLANNING"],
    },
    "MARKETING": {
        "description": "User needs marketing strategies, campaign creation, brand development, or promotional content guidance.",
        "keywords": [
            "marketing", "brand", "campaign", "social media", "seo", "content",
            "email", "customer", "segment", "funnel", "conversion", "lead",
            "advertising", "pr", "position", "promotion", "digital",
            "analytics", "engagement"
        ],
        "examples": [
            "Create a social media marketing strategy",
            "Help me develop a brand identity",
            "What's the best SEO strategy for my website?",
            "Create an email marketing campaign",
            "How do I segment my customer base?",
            "Help me write ad copy for Facebook",
            "How do I improve my conversion rate?",
            "Create a marketing funnel strategy",
            "Help me develop a product launch campaign",
            "Create a marketing calendar",
        ],
        "related_intents": ["BUSINESS", "WRITING", "DATA_ANALYSIS", "RESEARCH", "UI_UX_DESIGN"],
    },
    "LEGAL": {
        "description": "User seeks legal information, documentation, policy interpretation, or regulatory compliance guidance.",
        "keywords": [
            "legal", "law", "contract", "compliance", "copyright", "trademark",
            "patent", "liability", "regulation", "gdpr", "privacy", "employment",
            "dispute", "litigation", "agreement", "clause", "rights",
            "protection", "regulatory", "policy", "infringement"
        ],
        "examples": [
            "What's the difference between a contract and an agreement?",
            "How do I protect my intellectual property?",
            "What are the GDPR compliance requirements?",
            "Explain copyright law basics",
            "What are employee rights under labor law?",
            "What's the difference between LLC and corporation?",
            "What are the laws on data privacy?",
            "What's the purpose of a non-disclosure agreement?",
            "What's the difference between patent and copyright?",
            "What's the difference between arbitration and mediation?",
        ],
        "related_intents": ["BUSINESS", "FINANCE", "DOCUMENT_CREATION", "RESEARCH"],
        "requires_disclaimer": "not legal advice - consult an attorney",
    },
    "MEDICAL": {
        "description": "User requests health information, medical terminology explanation, wellness guidance, or disease/condition understanding.",
        "keywords": [
            "health", "medical", "medicine", "doctor", "patient", "symptom",
            "disease", "treatment", "diagnosis", "medication", "wellness",
            "nutrition", "diet", "fitness", "mental health", "hospital",
            "pharmaceutical", "clinical", "prevention", "therapy", "exercise"
        ],
        "examples": [
            "What are the symptoms of diabetes?",
            "Explain the benefits of exercise",
            "What is the Mediterranean diet?",
            "How does the cardiovascular system work?",
            "Explain the immune system",
            "What is cognitive behavioral therapy?",
            "What are the risk factors for heart disease?",
            "What is chronic pain management?",
            "Explain the ketogenic diet",
            "What is the importance of mental health?",
        ],
        "related_intents": ["RESEARCH", "DATA_ANALYSIS", "GENERAL_QUESTION_ANSWERING", "EDUCATION"],
        "requires_disclaimer": "not medical advice - consult a healthcare provider",
    },
    "DATA_ANALYSIS": {
        "description": "User needs data manipulation, statistical analysis, pattern recognition, or data visualization support.",
        "keywords": [
            "analysis", "data", "statistics", "chart", "graph", "visualize",
            "regression", "correlation", "sample", "hypothesis", "distribution",
            "outlier", "trend", "pattern", "segment", "cluster", "dashboard",
            "prediction", "model", "variable", "significance"
        ],
        "examples": [
            "Analyze this customer dataset for trends",
            "Create a chart showing sales by quarter",
            "What's the correlation between these variables?",
            "Perform linear regression on this data",
            "Help me clean this messy dataset",
            "Identify outliers in this dataset",
            "Create a dashboard for this data",
            "Help me find patterns in customer behavior",
            "Analyze the time series for seasonality",
            "Help me analyze these A/B test results",
        ],
        "related_intents": ["PROGRAMMING", "MATHEMATICS", "RESEARCH", "BUSINESS", "FINANCE"],
    },
    "TRANSLATION": {
        "description": "User requests language translation, localization, or interpretation between languages.",
        "keywords": [
            "translate", "language", "translation", "localization",
            "multilingual", "interpret", "convert", "linguistic",
            "cultural translation"
        ],
        "examples": [
            "Translate 'Hello, how are you?' to Spanish",
            "Translate this business document from English to Chinese",
            "What's the French translation for 'pencil'?",
            "Help me translate this legal contract",
            "How do you say 'I love you' in Japanese?",
            "Translate this poem from Arabic to English",
            "Translate this technical document to Korean",
            "Translate this website content to Portuguese",
            "What's the Hindi translation for 'water'?",
            "Translate this app interface to multiple languages",
        ],
        "related_intents": ["WRITING", "DOCUMENT_CREATION", "EDUCATION", "CUSTOMER_SUPPORT"],
    },
    "IMAGE_GENERATION": {
        "description": "User requests creation or modification of images, graphics, or visual art through AI generation.",
        "keywords": [
            "image", "picture", "photo", "generate", "design", "art",
            "illustration", "graphics", "visual", "painting", "render",
            "concept art", "scene", "artwork"
        ],
        "examples": [
            "Create an image of a futuristic city at night",
            "Generate a logo for a coffee shop",
            "Create an illustration of a dragon",
            "Make this photo look like a painting",
            "Design a cover for a sci-fi book",
            "Create an icon for a weather app",
            "Design a movie poster for a thriller",
            "Create a scene of a forest in autumn",
            "Generate a photo-realistic image of a tiger",
            "Create an infographic about recycling",
        ],
        "related_intents": ["UI_UX_DESIGN", "VIDEO_GENERATION", "MARKETING", "DOCUMENT_CREATION"],
    },
    "VIDEO_GENERATION": {
        "description": "User requests creation or manipulation of video content, animation, or moving visual media.",
        "keywords": [
            "video", "animation", "motion", "editing", "film", "render",
            "frame", "timeline", "scene", "storyboard", "special effects",
            "voiceover", "caption", "production", "filming"
        ],
        "examples": [
            "Create a short video of a sunset",
            "Generate an animation of a ball rolling",
            "Create a video script for a product demo",
            "Help me create a 3D animation",
            "Create a motion graphic for an intro",
            "Design a storyboard for a commercial",
            "Create a visual effects scene",
            "Create a video ad for Facebook",
            "Create a montage of my travel videos",
            "Create a time-lapse video",
        ],
        "related_intents": ["IMAGE_GENERATION", "WRITING", "MARKETING", "PRESENTATION_CREATION"],
    },
    "UI_UX_DESIGN": {
        "description": "User requests user interface and user experience design guidance, mockups, wireframes, or design principles.",
        "keywords": [
            "design", "user", "ux", "ui", "interface", "wireframe", "prototype",
            "user experience", "accessibility", "mobile", "web", "mockup",
            "user flow", "design system", "style guide", "user research"
        ],
        "examples": [
            "Create a wireframe for a login page",
            "What are the best design principles for mobile apps?",
            "Help me improve my website navigation",
            "Design a responsive UI for my application",
            "Create a user flow for this e-commerce site",
            "Design a card layout for a dashboard",
            "How to design accessible forms?",
            "Create a design system for a startup",
            "Design an onboarding experience",
            "How to conduct user testing?",
        ],
        "related_intents": ["IMAGE_GENERATION", "PROGRAMMING", "MARKETING", "DOCUMENT_CREATION"],
    },
    "DOCUMENT_CREATION": {
        "description": "User needs creation, formatting, or structuring of documents for specific purposes and formats.",
        "keywords": [
            "document", "template", "format", "structure", "report",
            "proposal", "letter", "brochure", "manual", "guide",
            "compliance", "policy", "organization"
        ],
        "examples": [
            "Create a document template for my business",
            "How to format a professional letter?",
            "What's the best way to structure a report?",
            "Create a policy document for my company",
            "What's the format for a business proposal?",
            "Create a template for a meeting agenda",
            "How to format a whitepaper?",
            "Design a user manual template",
            "Create a resume template for a developer",
            "How to format a research paper?",
        ],
        "related_intents": ["WRITING", "PRESENTATION_CREATION", "SPREADSHEET_TASKS", "BUSINESS", "LEGAL"],
    },
    "PRESENTATION_CREATION": {
        "description": "User needs to create, design, or improve presentations, slideshows, or visual aids for communication.",
        "keywords": [
            "presentation", "slides", "slide deck", "powerpoint", "keynote",
            "audience", "engagement", "flow", "storytelling", "visual aids",
            "speaker"
        ],
        "examples": [
            "Create a presentation template for my business",
            "Create slides for a marketing presentation",
            "How to design an engaging slide deck",
            "Create a presentation for a product launch",
            "Create a presentation with charts and graphs",
            "Create a presentation for a board meeting",
            "Create a presentation for a pitch deck",
            "What's the best presentation software to use?",
            "Create a presentation with a call to action",
            "Create a presentation for a conference keynote",
        ],
        "related_intents": ["DOCUMENT_CREATION", "WRITING", "IMAGE_GENERATION", "VIDEO_GENERATION", "MARKETING"],
    },
    "SPREADSHEET_TASKS": {
        "description": "User needs assistance with spreadsheet creation, data organization, formula writing, or data analysis in Excel, Google Sheets, or similar.",
        "keywords": [
            "spreadsheet", "excel", "google sheets", "formula", "pivot",
            "vlookup", "cells", "columns", "rows", "sum", "average",
            "count", "lookup", "sort", "filter"
        ],
        "examples": [
            "Create a spreadsheet for my personal budget",
            "How to write a VLOOKUP formula in Excel?",
            "Create a spreadsheet to track expenses",
            "How to use pivot tables in Google Sheets?",
            "How to use conditional formatting in spreadsheets?",
            "Create a spreadsheet to manage inventory",
            "How to write a SUM formula in Excel?",
            "Create a spreadsheet to track project progress",
            "How to use IF statements in spreadsheets",
            "Create a spreadsheet to track sales leads",
        ],
        "related_intents": ["DATA_ANALYSIS", "MATHEMATICS", "BUSINESS", "FINANCE", "AUTOMATION"],
    },
    "AUTOMATION": {
        "description": "User seeks help with automating processes, workflows, or repetitive tasks using tools, scripts, or AI.",
        "keywords": [
            "automation", "automate", "workflow", "script", "schedule",
            "repetitive", "process", "integrate", "optimize", "efficiency",
            "no-code", "triggers", "api integration", "batch", "scheduler"
        ],
        "examples": [
            "Help me automate my email marketing",
            "How to automate data entry in Excel?",
            "Create a script to web scrape this site",
            "How to use no-code automation tools?",
            "Help me automate my social media posting",
            "Create a workflow automation for my business",
            "How to schedule tasks with Python?",
            "Automate my report generation",
            "Help me automate my customer onboarding",
            "How to automate data backup?",
        ],
        "related_intents": ["PROGRAMMING", "DATA_ANALYSIS", "BUSINESS", "SPREADSHEET_TASKS", "CUSTOMER_SUPPORT"],
    },
    "GENERAL_QUESTION_ANSWERING": {
        "description": "User seeks quick, factual answers to general knowledge questions or information retrieval without deep research.",
        "keywords": [
            "what", "who", "where", "when", "why", "how", "meaning",
            "definition", "example", "fact", "knowledge", "information", "answer"
        ],
        "examples": [
            "What is the capital of France?",
            "How old is the universe?",
            "Who is the CEO of Apple?",
            "What is the tallest mountain in the world?",
            "How many planets are in our solar system?",
            "Why is the sky blue?",
            "Who invented the light bulb?",
            "What is the speed of light?",
            "What is the currency of Japan?",
            "Who painted the Mona Lisa?",
        ],
        "related_intents": ["RESEARCH", "EDUCATION"],
    },
    "BRAINSTORMING": {
        "description": "User needs creative idea generation, concept development, or exploration of possibilities without commitment to final output.",
        "keywords": [
            "brainstorm", "idea", "generate", "creative", "think", "innovative",
            "concept", "explore", "possibilities", "alternatives",
            "inspiration", "novel", "ideation"
        ],
        "examples": [
            "Brainstorm ideas for a birthday party",
            "Generate startup ideas in AI",
            "What are some creative writing prompts?",
            "Brainstorm marketing strategies for our product",
            "Generate ideas for a social media campaign",
            "What are some innovative product features?",
            "Brainstorm solutions to climate change",
            "Generate ideas for a team-building activity",
            "Brainstorm topics for a podcast",
            "What are some unique date ideas?",
        ],
        "related_intents": ["WRITING", "PLANNING", "MARKETING", "BUSINESS", "RESEARCH"],
    },
    "PLANNING": {
        "description": "User needs structured planning, organization, scheduling, or roadmap creation for projects or events.",
        "keywords": [
            "plan", "schedule", "timeline", "roadmap", "organize", "deadline",
            "milestones", "resource allocation", "coordinate", "task", "action"
        ],
        "examples": [
            "Plan a 5-day trip to Japan",
            "Create a project plan for a new website",
            "How to plan a wedding",
            "Create a timeline for a product launch",
            "Plan a budget for a family vacation",
            "Create a schedule for a conference",
            "Plan a fundraising event",
            "Create a project roadmap for a tech project",
            "Create a plan for a career transition",
            "Plan a content calendar",
        ],
        "related_intents": ["BRAINSTORMING", "BUSINESS", "TRAVEL"],
    },
    "TRAVEL": {
        "description": "User needs travel information, planning, recommendations, or guidance for trips and destinations.",
        "keywords": [
            "travel", "trip", "journey", "destination", "itinerary", "hotel",
            "flight", "airport", "accommodation", "tourist", "tour", "guide",
            "adventure", "vacation", "holiday", "sightseeing", "packing"
        ],
        "examples": [
            "Plan a 7-day itinerary in Japan",
            "What are the best places to visit in Italy?",
            "Tips for traveling to Europe on a budget",
            "What is the best time to visit Bali?",
            "What are the must-see attractions in Paris?",
            "Plan a road trip across the US",
            "What are the best ski resorts in Switzerland?",
            "Travel safety tips for solo female travelers",
            "Create a travel budget for a European trip",
            "Create a packing list for a beach vacation",
        ],
        "related_intents": ["PLANNING", "GENERAL_QUESTION_ANSWERING", "RESEARCH"],
    },
    "SHOPPING": {
        "description": "User needs product recommendations, purchase guidance, price comparisons, or shopping advice.",
        "keywords": [
            "shop", "buy", "purchase", "recommend", "best", "compare",
            "price", "cheap", "expensive", "quality", "product", "review",
            "budget", "gift", "deal"
        ],
        "examples": [
            "What's the best laptop under $1000?",
            "Recommend a smartphone with a great camera",
            "What are the best gaming mice?",
            "Recommend a gift for my wife's birthday",
            "Compare these two TVs",
            "What's the best time to buy a car?",
            "Recommend a budget-friendly laptop",
            "Compare the iPhone 14 and iPhone 15",
            "What are the best headphones under $200?",
            "What are the best smart home devices?",
        ],
        "related_intents": ["FINANCE", "GENERAL_QUESTION_ANSWERING", "RESEARCH"],
    },
    "CUSTOMER_SUPPORT": {
        "description": "User seeks assistance with product/service issues, troubleshooting, returns, or general customer service inquiries.",
        "keywords": [
            "support", "help", "customer", "service", "account", "login",
            "return", "refund", "warranty", "billing", "subscription",
            "upgrade", "cancel", "order", "shipping", "delivery", "complaint"
        ],
        "examples": [
            "How do I return this product?",
            "I need help with my account login",
            "What's the process for a refund?",
            "My service is not working as expected",
            "How do I upgrade my plan?",
            "How to cancel my subscription",
            "What's the warranty on this product?",
            "I need help with a billing error",
            "How do I reset my password?",
            "How to escalate my issue?",
        ],
        "related_intents": ["PROGRAMMING", "LEGAL", "SHOPPING"],
    },
    "AUDIO": {
        "description": "User requests assistance with audio content creation, editing, music production, or sound design.",
        "keywords": [
            "audio", "sound", "music", "track", "edit", "mix", "master",
            "record", "podcast", "voice", "beat", "production", "composer",
            "waveform", "studio", "microphone"
        ],
        "examples": [
            "How to edit an audio file?",
            "Create a soundtrack for a video",
            "How to improve audio quality?",
            "What's the best music production software?",
            "How to remove background noise from audio?",
            "Create a beat for a song",
            "How to compose music for a film?",
            "How to mix audio for a podcast?",
            "How to record a voiceover?",
            "How to master audio for YouTube?",
        ],
        "related_intents": ["VIDEO_GENERATION", "MARKETING"],
    },
}

CONFIDENCE_BANDS = {
    "HIGH": (90, 100),
    "MEDIUM": (60, 89),
    "LOW": (0, 59),
}


def confidence_band(score: float) -> str:
    if score >= 90:
        return "HIGH"
    if score >= 60:
        return "MEDIUM"
    return "LOW"
