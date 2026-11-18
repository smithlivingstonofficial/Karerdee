const path = require("path");
const fs = require("fs");

const envPath = path.resolve(__dirname, "../admin-web/.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  const [key, ...vals] = line.trim().split("=");
  if (key && vals.length > 0) {
    env[key] = vals.join("=").replace(/^"|"$/g, "");
  }
});

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceKey = env["SUPABASE_SERVICE_ROLE_KEY"];

// 1. 30 Authentic English Common Research Aptitude Questions
const englishCommonQuestions = [
  {
    prompt: "Which research design is best suited to establish direct cause-and-effect relationships between variables?",
    topic: "Research Methodology",
    difficulty: "EASY",
    options: [
      { text: "Experimental Design with Controlled Manipulation", is_correct: true },
      { text: "Correlational Cross-Sectional Study", is_correct: false },
      { text: "Descriptive Narrative Review", is_correct: false },
      { text: "Ex-Post Facto Retrospective Survey", is_correct: false },
    ],
  },
  {
    prompt: "In empirical research, what constitutes an authentic testable hypothesis?",
    topic: "Hypothesis Formulation",
    difficulty: "MEDIUM",
    options: [
      { text: "A tentative, falsifiable proposition predicting a relationship between variables", is_correct: true },
      { text: "An immutable law established by academic consensus", is_correct: false },
      { text: "A broad, speculative philosophical opinion", is_correct: false },
      { text: "A post-hoc summary of observational findings", is_correct: false },
    ],
  },
  {
    prompt: "What unique persistent alphanumeric identifier assigned by the International DOI Foundation guarantees permanent indexing of scholarly articles?",
    topic: "Academic Publishing",
    difficulty: "EASY",
    options: [
      { text: "Digital Object Identifier (DOI)", is_correct: true },
      { text: "International Standard Book Number (ISBN)", is_correct: false },
      { text: "International Standard Serial Number (ISSN)", is_correct: false },
      { text: "Uniform Resource Locator (URL)", is_correct: false },
    ],
  },
  {
    prompt: "A Type I error (False Positive) in statistical hypothesis testing occurs when the researcher:",
    topic: "Statistical Inference",
    difficulty: "HARD",
    options: [
      { text: "Rejects a true null hypothesis (H0)", is_correct: true },
      { text: "Fails to reject a false null hypothesis (H0)", is_correct: false },
      { text: "Accepts the alternative hypothesis when it is true", is_correct: false },
      { text: "Fails to formulate a directional hypothesis", is_correct: false },
    ],
  },
  {
    prompt: "Which probability sampling method divides a heterogeneous population into homogeneous subgroups before random selection?",
    topic: "Sampling Techniques",
    difficulty: "MEDIUM",
    options: [
      { text: "Stratified Random Sampling", is_correct: true },
      { text: "Convenience Purposive Sampling", is_correct: false },
      { text: "Snowball Chain-Referral Sampling", is_correct: false },
      { text: "Cluster Area Sampling", is_correct: false },
    ],
  },
  {
    prompt: "What does the h-index measure in academic and scientific research evaluation?",
    topic: "Bibliometrics",
    difficulty: "MEDIUM",
    options: [
      { text: "Both the productivity and citation impact of a published scholar", is_correct: true },
      { text: "The total number of authored journal articles regardless of citations", is_correct: false },
      { text: "The financial endowment received by an investigator", is_correct: false },
      { text: "The chronological duration of an author's research career", is_correct: false },
    ],
  },
  {
    prompt: "Plagiarism in doctoral research is defined by the UGC as:",
    topic: "Research Ethics",
    difficulty: "EASY",
    options: [
      { text: "The unattributed practice of using another author's ideas, text, or results as one's own", is_correct: true },
      { text: "Publishing collaborative research across multi-institutional teams", is_correct: false },
      { text: "Translating one's own published paper with full citation", is_correct: false },
      { text: "Citing peer-reviewed literature using APA or IEEE guidelines", is_correct: false },
    ],
  },
  {
    prompt: "In longitudinal cohort studies, what is the primary threat to internal validity caused by participant dropouts over time?",
    topic: "Research Design",
    difficulty: "HARD",
    options: [
      { text: "Experimental Attrition / Mortality", is_correct: true },
      { text: "Instrument Decay", is_correct: false },
      { text: "Statistical Regression to the Mean", is_correct: false },
      { text: "History Confounding", is_correct: false },
    ],
  },
  {
    prompt: "Which scale of measurement possesses an absolute, non-arbitrary meaningful zero point?",
    topic: "Measurement & Scaling",
    difficulty: "MEDIUM",
    options: [
      { text: "Ratio Scale (e.g., Kelvin temperature, mass, distance)", is_correct: true },
      { text: "Interval Scale (e.g., Celsius temperature)", is_correct: false },
      { text: "Ordinal Scale (e.g., Likert rating, class rank)", is_correct: false },
      { text: "Nominal Scale (e.g., gender, nationality)", is_correct: false },
    ],
  },
  {
    prompt: "What is the primary function of a peer-reviewed 'Double-Blind' review mechanism?",
    topic: "Academic Publishing",
    difficulty: "EASY",
    options: [
      { text: "Both the reviewers and the authors remain completely anonymous to eliminate bias", is_correct: true },
      { text: "The reviewers do not know the title of the research manuscript", is_correct: false },
      { text: "The editor selects reviewers without seeing the research data", is_correct: false },
      { text: "The manuscript is reviewed twice by the same evaluator", is_correct: false },
    ],
  },
  {
    prompt: "In qualitative methodology, 'Grounded Theory' was originally formulated by:",
    topic: "Qualitative Research",
    difficulty: "HARD",
    options: [
      { text: "Barney Glaser and Anselm Strauss", is_correct: true },
      { text: "John W. Creswell and Vicki L. Plano Clark", is_correct: false },
      { text: "Norman Denzin and Yvonna Lincoln", is_correct: false },
      { text: "Robert K. Yin", is_correct: false },
    ],
  },
  {
    prompt: "The standard measure of internal consistency reliability for multi-item Likert scales is:",
    topic: "Measurement Reliability",
    difficulty: "MEDIUM",
    options: [
      { text: "Cronbach's Alpha (α)", is_correct: true },
      { text: "Pearson's Correlation Coefficient (r)", is_correct: false },
      { text: "Cohen's Kappa (κ)", is_correct: false },
      { text: "Student's t-statistic", is_correct: false },
    ],
  },
  {
    prompt: "Which referencing style is predominant in Computer Science and Electrical Engineering publications?",
    topic: "Academic Referencing",
    difficulty: "EASY",
    options: [
      { text: "IEEE Numeric Citation Style [1]", is_correct: true },
      { text: "APA Author-Date Style", is_correct: false },
      { text: "Chicago Footnote Style", is_correct: false },
      { text: "MLA Author-Page Style", is_correct: false },
    ],
  },
  {
    prompt: "Triangulation in empirical inquiry refers to:",
    topic: "Mixed Methods",
    difficulty: "MEDIUM",
    options: [
      { text: "Using multiple data sources, investigators, or methodologies to validate a phenomenon", is_correct: true },
      { text: "Restricting an investigation strictly to three operational variables", is_correct: false },
      { text: "Conducting an experiment in three distinct geographical locations", is_correct: false },
      { text: "Partitioning an empirical sample into three equal cohorts", is_correct: false },
    ],
  },
  {
    prompt: "What statistical test is appropriate to compare the means of three or more independent continuous groups?",
    topic: "Inferential Statistics",
    difficulty: "MEDIUM",
    options: [
      { text: "One-Way Analysis of Variance (ANOVA)", is_correct: true },
      { text: "Independent Samples Student's t-test", is_correct: false },
      { text: "Chi-Square Test of Independence", is_correct: false },
      { text: "Mann-Whitney U Test", is_correct: false },
    ],
  },
  {
    prompt: "A central ethical requirement before enrolling human subjects in behavioral or clinical research is:",
    topic: "Research Ethics",
    difficulty: "EASY",
    options: [
      { text: "Informed Voluntary Consent with right of withdrawal", is_correct: true },
      { text: "Pre-payment of financial compensation to investigators", is_correct: false },
      { text: "Mandatory waiver of personal privacy rights", is_correct: false },
      { text: "Immediate public disclosure of individual raw records", is_correct: false },
    ],
  },
  {
    prompt: "The Journal Impact Factor (JIF) is officially indexed and calculated by:",
    topic: "Bibliometrics",
    difficulty: "MEDIUM",
    options: [
      { text: "Clarivate Analytics (Web of Science / Journal Citation Reports)", is_correct: true },
      { text: "Google Scholar Metrics", is_correct: false },
      { text: "Directory of Open Access Journals (DOAJ)", is_correct: false },
      { text: "Scimago Lab / Elsevier", is_correct: false },
    ],
  },
  {
    prompt: "Which data collection technique relies on in-depth guided discussion among 6–10 pre-screened participants?",
    topic: "Qualitative Data",
    difficulty: "EASY",
    options: [
      { text: "Focus Group Discussion (FGD)", is_correct: true },
      { text: "Structured Closed-Ended Questionnaire", is_correct: false },
      { text: "Uncontrolled Naturalistic Observation", is_correct: false },
      { text: "Single-Subject Case Study", is_correct: false },
    ],
  },
  {
    prompt: "What characterizes a 'Null Hypothesis' (H0)?",
    topic: "Hypothesis Testing",
    difficulty: "EASY",
    options: [
      { text: "It posits no significant difference or relationship between variables", is_correct: true },
      { text: "It proves the researcher's theoretical conviction", is_correct: false },
      { text: "It states that the sample size is zero", is_correct: false },
      { text: "It is formulated only after analyzing experimental outcomes", is_correct: false },
    ],
  },
  {
    prompt: "In experimental research, an extraneous variable that unintentionally influences the dependent variable is called a:",
    topic: "Experimental Controls",
    difficulty: "MEDIUM",
    options: [
      { text: "Confounding Variable", is_correct: true },
      { text: "Manipulated Independent Variable", is_correct: false },
      { text: "Outcome Variable", is_correct: false },
      { text: "Categorical Attribute", is_correct: false },
    ],
  },
  {
    prompt: "What is an eight-digit unique number assigned to identify serial publications such as scholarly journals?",
    topic: "Academic Publishing",
    difficulty: "EASY",
    options: [
      { text: "ISSN (International Standard Serial Number)", is_correct: true },
      { text: "ISBN (International Standard Book Number)", is_correct: false },
      { text: "ORCID iD", is_correct: false },
      { text: "PubMed ID (PMID)", is_correct: false },
    ],
  },
  {
    prompt: "The non-profit identifier registry that provides researchers with a unique, persistent digital author identifier is:",
    topic: "Scholarly Identity",
    difficulty: "EASY",
    options: [
      { text: "ORCID (Open Researcher and Contributor ID)", is_correct: true },
      { text: "Scopus Author ID", is_correct: false },
      { text: "ResearcherID", is_correct: false },
      { text: "Google Scholar Citations ID", is_correct: false },
    ],
  },
  {
    prompt: "Which research approach combines both quantitative and qualitative methods within a single investigative study?",
    topic: "Research Paradigms",
    difficulty: "EASY",
    options: [
      { text: "Mixed Methods Research", is_correct: true },
      { text: "Pure Positivist Quantitative Research", is_correct: false },
      { text: "Constructivist Qualitative Research", is_correct: false },
      { text: "Historical Archival Research", is_correct: false },
    ],
  },
  {
    prompt: "When sample findings can be legitimately generalized to a broader population, the study possesses high:",
    topic: "Validity",
    difficulty: "MEDIUM",
    options: [
      { text: "External Validity (Ecological Generalizability)", is_correct: true },
      { text: "Internal Validity", is_correct: false },
      { text: "Content Validity", is_correct: false },
      { text: "Face Validity", is_correct: false },
    ],
  },
  {
    prompt: "A literature review that employs transparent, repeatable protocols to identify and synthesize all relevant evidence is a:",
    topic: "Literature Review",
    difficulty: "MEDIUM",
    options: [
      { text: "Systematic Literature Review (SLR) / Meta-Analysis", is_correct: true },
      { text: "Narrative Traditional Review", is_correct: false },
      { text: "Opinion Editorial Essay", is_correct: false },
      { text: "Bibliographic Book Review", is_correct: false },
    ],
  },
  {
    prompt: "What is the primary indicator of statistical significance in hypothesis testing when alpha is set to 0.05?",
    topic: "Statistical Significance",
    difficulty: "MEDIUM",
    options: [
      { text: "p-value < 0.05 indicates statistical significance", is_correct: true },
      { text: "p-value > 0.05 proves the hypothesis", is_correct: false },
      { text: "p-value must equal exactly 1.0", is_correct: false },
      { text: "p-value is unrelated to alpha threshold", is_correct: false },
    ],
  },
  {
    prompt: "In survey research, what bias occurs when certain population groups systematically refuse or fail to respond?",
    topic: "Sampling Biases",
    difficulty: "MEDIUM",
    options: [
      { text: "Non-Response Bias", is_correct: true },
      { text: "Social Desirability Bias", is_correct: false },
      { text: "Recall Bias", is_correct: false },
      { text: "Observer Expectancy Effect", is_correct: false },
    ],
  },
  {
    prompt: "According to UGC Ph.D regulations, what is the maximum permissible similarity index (excluding bibliography) for acceptable thesis submission?",
    topic: "Institutional Regulations",
    difficulty: "EASY",
    options: [
      { text: "Less than or equal to 10% (Level 0 similarity)", is_correct: true },
      { text: "Up to 30%", is_correct: false },
      { text: "Up to 50%", is_correct: false },
      { text: "Zero tolerance (0%) under all circumstances", is_correct: false },
    ],
  },
  {
    prompt: "The term 'Post-Doc' refers to an academic scholar who:",
    topic: "Academic Ranks",
    difficulty: "EASY",
    options: [
      { text: "Conducts advanced postdoctoral research after having been awarded a doctoral degree", is_correct: true },
      { text: "Is currently enrolled in the first year of a Master's degree", is_correct: false },
      { text: "Is an undergraduate preparing an entrance exam", is_correct: false },
      { text: "Is an administrative officer in university examinations", is_correct: false },
    ],
  },
  {
    prompt: "The repository mandated by UGC and INFLIBNET for archiving Indian electronic doctoral dissertations is:",
    topic: "Digital Repositories",
    difficulty: "EASY",
    options: [
      { text: "Shodhganga", is_correct: true },
      { text: "Shodhgangotri", is_correct: false },
      { text: "e-PG Pathshala", is_correct: false },
      { text: "SWAYAM", is_correct: false },
    ],
  },
];

// 2. 30 Authentic Tamil Common Research Aptitude Questions (தமிழ் பொதுத்தாள் - ஆராய்ச்சி முறைமை & பொது நுண்ணறிவு)
const tamilCommonQuestions = [
  {
    prompt: "அறிவியல் ஆராய்ச்சியில் 'கருதுகோள்' (Hypothesis) என்பதன் முதன்மையான இலக்கணம் யாது?",
    topic: "ஆராய்ச்சி முறைமை (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "முன்கூட்டியே கணிக்கப்பட்ட, சோதனைக்கு உட்படுத்தக்கூடிய தற்காலிகக் கூற்று", is_correct: true },
      { text: "மாற்ற முடியாத பொதுவான அறிவியல் விதி", is_correct: false },
      { text: "ஆய்வு நூலின் இறுதி முடிவுரைச் சுருக்கம்", is_correct: false },
      { text: "ஆராய்ச்சியாளரின் தனிப்பட்ட தத்துவார்த்தக் கருத்து", is_correct: false },
    ],
  },
  {
    prompt: "ஆய்வேடுகளில் (Research Papers) ஆய்வுக் கட்டுரைகளை இணையத்தில் நிரந்தரமாகக் கண்டறிய வழங்கப்படும் பிரத்யேக எண் குறியீடு எது?",
    topic: "ஆய்வு வெளியீடு (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "DOI (Digital Object Identifier)", is_correct: true },
      { text: "ISBN (International Standard Book Number)", is_correct: false },
      { text: "ISSN (International Standard Serial Number)", is_correct: false },
      { text: "URL (Uniform Resource Locator)", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியாளரால் களப்பணியின் மூலம் நேரடியாகவும் முதன்முறையாகவும் சேகரிக்கப்படும் புதிய தகவல்கள் எவ்வாறு அழைக்கப்படுகின்றன?",
    topic: "தரவு சேகரிப்பு (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "முதல்நிலைத் தரவு (Primary Data)", is_correct: true },
      { text: "இரண்டாம் நிலைத் தரவு (Secondary Data)", is_correct: false },
      { text: "மாதிரித் தரவு (Sample Data)", is_correct: false },
      { text: "தொகுக்கப்பட்ட வரலாற்றுத் தரவு", is_correct: false },
    ],
  },
  {
    prompt: "புள்ளியியல் கருதுகோள் சோதனையில் (Hypothesis Testing), உண்மை என இருக்கும் 'இன்மை கருதுகோளை' (Null Hypothesis - H0) தவறுதலாக நிராகரிப்பது எத்தகைய பிழையாகும்?",
    topic: "புள்ளியியல் முறைமை (Tamil)",
    difficulty: "HARD",
    options: [
      { text: "முதல் வகை பிழை (Type I Error / False Positive)", is_correct: true },
      { text: "இரண்டாம் வகை பிழை (Type II Error)", is_correct: false },
      { text: "மாதிரி சேகரிப்பு பிழை (Sampling Bias)", is_correct: false },
      { text: "கணக்கீட்டு பிழை (Measurement Error)", is_correct: false },
    ],
  },
  {
    prompt: "பல்வேறு குணாதிசயங்களைக் கொண்ட ஒரு பெரும் மக்கள் தொகையை ஒத்த பண்புகளுடைய துணைக் குழுக்களாகப் பிரித்து மாதிரி எடுக்கும் முறை எது?",
    topic: "மாதிரித் தேர்வு முறை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "பிரிவுபடுத்தப்பட்ட சமவாய்ப்பு மாதிரி (Stratified Random Sampling)", is_correct: true },
      { text: "வசதிசார் மாதிரி முறை (Convenience Sampling)", is_correct: false },
      { text: "பனிப்பந்து மாதிரி முறை (Snowball Sampling)", is_correct: false },
      { text: "நோக்கசார் மாதிரி முறை (Purposive Sampling)", is_correct: false },
    ],
  },
  {
    prompt: "பல்கலைக்கழக மானியக் குழுவின் (UGC) வழிகாட்டுதலின்படி, முனைவர் பட்ட ஆய்வேடுகளில் அனுமதிக்கப்படும் அதிகபட்ச ஒப்புமை அளவு (Plagiarism Similarity Index) எவ்வளவு?",
    topic: "ஆய்வு நெறிமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "10% வரை மட்டுமே (நிலை 0 - Level 0 Similarity)", is_correct: true },
      { text: "25% வரை", is_correct: false },
      { text: "40% வரை", is_correct: false },
      { text: "எந்தவொரு ஒப்புமையும் அனுமதிக்கப்படாது (0%)", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியாளர் ஒருவரின் ஆய்வுத் தாள்களின் எண்ணிக்கை மற்றும் அவற்றின் மேற்கோள் தாக்கத்தை (Citation Impact) மதிப்பிடும் குறியீடு எது?",
    topic: "ஆய்வு மதிப்பீடு (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "எச்-குறியீடு (h-index)", is_correct: true },
      { text: "ஐ-10 குறியீடு (i10-index)", is_correct: false },
      { text: "ஜி-குறியீடு (g-index)", is_correct: false },
      { text: "தாக்கக் காரணி (Impact Factor)", is_correct: false },
    ],
  },
  {
    prompt: "ஆய்வில் பங்கேற்கும் நபர்களின் எழுத்துப்பூர்வமான சுயவிருப்ப ஒப்புதல் (Informed Consent) எதன் கீழ் அவசியமாகிறது?",
    topic: "ஆய்வு நெறிமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "ஆராய்ச்சி அறநெறி மற்றும் மனித உரிமை பாதுகாப்பு (Research Ethics)", is_correct: true },
      { text: "நிதி திரட்டும் வழிமுறை", is_correct: false },
      { text: "நூலக மேலாண்மை சட்டம்", is_correct: false },
      { text: "பல்கலைக்கழக தேர்வு கட்டணம்", is_correct: false },
    ],
  },
  {
    prompt: "இந்தியாவில் சமர்ப்பிக்கப்படும் முனைவர் பட்ட ஆய்வேடுகளை (Ph.D Theses) மின்னணு முறையில் பாதுகாக்கும் INFLIBNET தேசியக் களஞ்சியம் எது?",
    topic: "மின்னணுக் களஞ்சியம் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "சோத்கங்கா (Shodhganga)", is_correct: true },
      { text: "சோத்கங்கோத்ரி (Shodhgangotri)", is_correct: false },
      { text: "ஈ-பிஜி பாடசாலா (e-PG Pathshala)", is_correct: false },
      { text: "சுயம் (SWAYAM)", is_correct: false },
    ],
  },
  {
    prompt: "ஒரு ஆய்வில் காரண-காரியத் தொடர்பை (Cause and Effect Relationship) மிகத் துல்லியமாக மெய்ப்பிக்கப் பயன்படும் ஆய்வு வடிவமைப்பு எது?",
    topic: "ஆய்வு வடிவமைப்பு (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "பரிசோதனை ஆய்வு முறை (Experimental Research Design)", is_correct: true },
      { text: "விளக்கக் கள ஆய்வு (Descriptive Survey)", is_correct: false },
      { text: "வரலாற்றுப் பின்னணி ஆய்வு (Historical Research)", is_correct: false },
      { text: "தனிநபர் ஆய்வு (Case Study)", is_correct: false },
    ],
  },
  {
    prompt: "பருவ இதழ்கள் மற்றும் தொடர் வெளியீடுகளுக்கு உலகளவில் வழங்கப்படும் 8 இலக்க தனித்துவ அடையாள எண் எது?",
    topic: "ஆய்வு வெளியீடு (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "ISSN (International Standard Serial Number)", is_correct: true },
      { text: "ISBN (International Standard Book Number)", is_correct: false },
      { text: "ORCID (Open Researcher ID)", is_correct: false },
      { text: "CODEN குறியீடு", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியாளர்களுக்கு உலகளவில் பிரத்யேகமாக வழங்கப்படும் 16 இலக்க இலக்கவியல் அடையாளக் குறியீடு (Digital Identifier) எது?",
    topic: "ஆய்வாளர் அடையாளம் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "ORCID (Open Researcher and Contributor ID)", is_correct: true },
      { text: "Scopus Author ID", is_correct: false },
      { text: "ResearcherID", is_correct: false },
      { text: "Google Scholar Profile ID", is_correct: false },
    ],
  },
  {
    prompt: "அளவீட்டு அளவுகோல்களில் (Scales of Measurement) மிகக் கண்டிப்பான 'மெய்யான சுழி புள்ளி' (Absolute Zero Point) கொண்ட அளவுகோல் எது?",
    topic: "அளவீட்டு முறைமை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "விகித அளவுகோல் (Ratio Scale - எ.கா: எடை, நீளம், கெல்வின் வெப்பநிலை)", is_correct: true },
      { text: "இடைவெளி அளவுகோல் (Interval Scale - எ.கா: செல்சியஸ் வெப்பநிலை)", is_correct: false },
      { text: "வரிசை அளவுகோல் (Ordinal Scale - எ.கா: தகுதி வரிசை)", is_correct: false },
      { text: "பெயரளவு அளவுகோல் (Nominal Scale - எ.கா: பாலினம்)", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியில் 'இன்மை கருதுகோள்' (Null Hypothesis - H0) என்பது எதனைக் குறிக்கிறது?",
    topic: "கருதுகோள் கோட்பாடு (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "ஆய்வுக்குரிய மாறிகளுக்கு இடையே எவ்வித குறிப்பிடத்தக்க வேறுபாடும் இல்லை எனக் கூறுவது", is_correct: true },
      { text: "ஆராய்ச்சியாளரின் சொந்த கணிப்பு உண்மையானது எனக் கூறுவது", is_correct: false },
      { text: "மாதிரி அளவு சுழியாக உள்ளது எனக் கூறுவது", is_correct: false },
      { text: "முடிவுகள் எப்போதும் நேர்மறையாக இருக்கும் எனக் கூறுவது", is_correct: false },
    ],
  },
  {
    prompt: "ஒரே ஆய்வில் அளவாக்க முறை (Quantitative) மற்றும் பண்பறி முறை (Qualitative) ஆகிய இரண்டு அணுகுமுறைகளையும் இணைத்துப் பயன்படுத்தும் ஆய்வு எது?",
    topic: "ஆய்வு அணுகுமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "கலப்பு ஆய்வு முறை (Mixed Methods Research)", is_correct: true },
      { text: "தூய நேர்மறை ஆய்வு முறை (Positivist Research)", is_correct: false },
      { text: "வரலாற்று விளக்க ஆய்வு (Historical Descriptive Research)", is_correct: false },
      { text: "ஆவண பகுப்பாய்வு முறை", is_correct: false },
    ],
  },
  {
    prompt: "ஒரு ஆய்வின் மாதிரியிலிருந்து பெறப்பட்ட முடிவுகளை ஒட்டுமொத்த மக்கள் தொகைக்கும் பொதுமைப்படுத்தக்கூடிய திறன் எவ்வாறு அழைக்கப்படுகிறது?",
    topic: "ஆய்வு நம்பகத்தன்மை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "வெளிப்புற ஏற்புடைமை (External Validity / Generalizability)", is_correct: true },
      { text: "உட்புற ஏற்புடைமை (Internal Validity)", is_correct: false },
      { text: "முகப்பு ஏற்புடைமை (Face Validity)", is_correct: false },
      { text: "உள்ளடக்க ஏற்புடைமை (Content Validity)", is_correct: false },
    ],
  },
  {
    prompt: "ஆய்வு மதிப்பீட்டில் மதிப்பாய்வாளருக்கும் (Reviewer) கட்டுரை ஆசிரியருக்கும் (Author) ஒருவரையொருவர் தெரியாமல் மறைத்து நடத்தப்படும் மதிப்பாய்வு முறை எது?",
    topic: "ஆய்வு நெறிமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "இருவழி மறைவு மதிப்பாய்வு முறை (Double-Blind Peer Review)", is_correct: true },
      { text: "ஒருவழி மறைவு முறை (Single-Blind Review)", is_correct: false },
      { text: "திறந்த மதிப்பாய்வு முறை (Open Peer Review)", is_correct: false },
      { text: "ஆசிரியர் நேரடி மதிப்பாய்வு", is_correct: false },
    ],
  },
  {
    prompt: "மூன்று அல்லது அதற்கு மேற்பட்ட தனித்த குழுக்களின் சராசரிகளை (Means) ஒப்பிட்டுப் பகுப்பாய்வு செய்யப் பயன்படும் புள்ளியியல் சோதனை எது?",
    topic: "புள்ளியியல் முறைமை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "மாறுபாட்டுப் பகுப்பாய்வு (ANOVA - Analysis of Variance)", is_correct: true },
      { text: "ஸ்டூடன்ட் டி-சோதனை (Student's t-test)", is_correct: false },
      { text: "கை-வர்க்க சோதனை (Chi-Square Test)", is_correct: false },
      { text: "வில்வாக்ஸன் சோதனை (Wilcoxon Test)", is_correct: false },
    ],
  },
  {
    prompt: "வினாத்தாள்களின் உள்-நிலை நிலைத்தன்மை நம்பகத்தன்மையை (Internal Consistency Reliability) அளவிடப் பயன்படும் பொதுவான குறியீடு எது?",
    topic: "அளவீட்டு நம்பகத்தன்மை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "குரோன்பாக் ஆல்பா (Cronbach's Alpha - α)", is_correct: true },
      { text: "பியர்சன் தொடர்பு குணகம் (Pearson's r)", is_correct: false },
      { text: "கோஹனின் கப்பா (Cohen's Kappa)", is_correct: false },
      { text: "ஸ்பியர்மேனின் ரோ (Spearman's Rho)", is_correct: false },
    ],
  },
  {
    prompt: "ஒரு ஆய்வில் திட்டமிட்ட மாறிகளைத் தவிர்த்து, சார்பு மாறியின் முடிவுகளை எதிர்பாராமல் பாதிக்கும் புற மாறிகள் எவ்வாறு அழைக்கப்படுகின்றன?",
    topic: "ஆய்வு மாறிகள் (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "குழப்பமூட்டும் மாறிகள் (Confounding Variables)", is_correct: true },
      { text: "தனித்து இயங்கும் மாறிகள் (Independent Variables)", is_correct: false },
      { text: "சார்பு மாறிகள் (Dependent Variables)", is_correct: false },
      { text: "கட்டுப்படுத்தப்பட்ட மாறிகள் (Control Variables)", is_correct: false },
    ],
  },
  {
    prompt: "தரவு சேகரிப்பில் 6 முதல் 10 நபர்களைக் கொண்ட குழுவினரிடையே ஆழமான விவாதத்தை நடத்தி கருத்துக்களைப் பெறும் பண்பறி முறை எது?",
    topic: "பண்பறி ஆய்வு (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "குழுக்குவி விவாதம் (Focus Group Discussion - FGD)", is_correct: true },
      { text: "மூடிய வினாக்கொத்து முறை (Closed Questionnaire)", is_correct: false },
      { text: "தனிநபர் அஞ்சல் வழி ஆய்வு", is_correct: false },
      { text: "இயற்கைக் களக் கவனிப்பு", is_correct: false },
    ],
  },
  {
    prompt: "முன்னரே வெளியிடப்பட்ட பிறரது கருத்துக்கள், உரைநடை அல்லது முடிவுகளை உரிய மேற்கோள் காட்டாமல் தமது சொந்தப் படைப்பாகப் பயன்படுத்துவது எக்குற்றமாகும்?",
    topic: "ஆய்வு நெறிமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "கருத்துத் திருட்டு / படைப்புத் திருட்டு (Plagiarism)", is_correct: true },
      { text: "இணை ஆசிரியர் உரிமை", is_correct: false },
      { text: "நூலக உசாத்துணை முறை", is_correct: false },
      { text: "திறந்தநிலை ஆய்வு வெளியீடு", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியில் ஏற்கனவே உள்ள இலக்கியங்களை முறையான நெறிமுறைகளுடன் முழுமையாகத் தொகுத்து மறுஆய்வு செய்யும் முறை எது?",
    topic: "நூல் மறுஆய்வு (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "முறைசார் இலக்கிய மறுஆய்வு (Systematic Literature Review - SLR)", is_correct: true },
      { text: "பாரம்பரிய கதை வடிவிலான மறுஆய்வு", is_correct: false },
      { text: "செய்தித்தாள் தலையங்கக் கட்டுரை", is_correct: false },
      { text: "நூல் விமர்சனக் குறிப்பு", is_correct: false },
    ],
  },
  {
    prompt: "ஆய்வு முடிவுகளின் புள்ளியியல் முக்கியத்துவத்தை (Statistical Significance) தீர்மானிக்க வழக்கமாக ஏற்றுக்கொள்ளப்படும் 'p' மதிப்பு (Alpha = 0.05 எனில்) என்ன?",
    topic: "புள்ளியியல் முறைமை (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "p மதிப்பு 0.05-ஐ விடக் குறைவாக இருத்தல் வேண்டும் (p < 0.05)", is_correct: true },
      { text: "p மதிப்பு 0.05-ஐ விட அதிகமாக இருத்தல் வேண்டும்", is_correct: false },
      { text: "p மதிப்பு சரியாக 1.0 ஆக இருத்தல் வேண்டும்", is_correct: false },
      { text: "p மதிப்பு எப்போதுமே எதிர்மறையாக இருத்தல் வேண்டும்", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சியில் ஒரு நிகழ்வின் உண்மைத்தன்மையை உறுதிப்படுத்த பல தரவு மூலங்கள் அல்லது பல முறைகளைப் பயன்படுத்துவது எவ்வாறு அழைக்கப்படுகிறது?",
    topic: "ஆய்வு அணுகுமுறைகள் (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "முக்கோண முறைமை / பல்வகை சரிபார்ப்பு முறை (Triangulation)", is_correct: true },
      { text: "மூன்று கட்ட மாதிரி ஆய்வு", is_correct: false },
      { text: "மூன்று மாறிகள் கொண்ட ஆய்வு", is_correct: false },
      { text: "முக்கோண வரைபட பகுப்பாய்வு", is_correct: false },
    ],
  },
  {
    prompt: "பொதுமக்கள் மத்தியில் குறிப்பிட்ட ஒரு பிரிவினர் ஆய்வு வினாக்கொத்துக்கு பதிலளிக்க மறுப்பதால் அல்லது தவறவிடுவதால் ஏற்படும் பிழை எது?",
    topic: "மாதிரிப் பிழைகள் (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "பதிலளிக்காமைப் பிழை (Non-Response Bias)", is_correct: true },
      { text: "சமூக விரும்பத்தக்க சார்பு (Social Desirability Bias)", is_correct: false },
      { text: "நினைவுகூர்தல் பிழை (Recall Bias)", is_correct: false },
      { text: "கவனிப்பாளர் எதிர்பார்ப்புப் பிழை", is_correct: false },
    ],
  },
  {
    prompt: "ஆராய்ச்சி இதழ்களின் அதிகாரப்பூர்வ 'தாக்கக் காரணி' (Journal Impact Factor - JIF) யாரால் கணக்கிடப்பட்டு வெளியிடப்படுகிறது?",
    topic: "ஆய்வு மதிப்பீடு (Tamil)",
    difficulty: "MEDIUM",
    options: [
      { text: "கிளாரிவேட் அனாலிடிக்ஸ் (Clarivate Analytics / Web of Science)", is_correct: true },
      { text: "கூகுள் ஸ்காலர் மெட்ரிக்ஸ் (Google Scholar)", is_correct: false },
      { text: "எக்ஸ்பிரஸ் ஆய்வு நிறுவனம்", is_correct: false },
      { text: "திறந்தநிலை அணுகல் இதழ்கள் வழிகாட்டி (DOAJ)", is_correct: false },
    ],
  },
  {
    prompt: "ஒரு ஆய்வில் பங்கேற்கும் நபர் எந்த நேரத்திலும் தனது விருப்பத்தின் பேரில் ஆய்விலிருந்து விலகிக்கொள்ளும் உரிமை எதனால் பாதுகாக்கப்படுகிறது?",
    topic: "ஆய்வு நெறிமுறைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "சுயவிருப்பப் பங்கேற்பு மற்றும் விலகல் உரிமை (Voluntary Participation)", is_correct: true },
      { text: "கட்டாய ஒப்பந்த சட்டம்", is_correct: false },
      { text: "பல்கலைக்கழக வருகைப் பதிவு விதி", is_correct: false },
      { text: "ஆய்வு நிதி முதலீட்டு விதி", is_correct: false },
    ],
  },
  {
    prompt: "ஆய்வுக் கட்டுரைகளில் மேற்கோள் காட்டப்படும் (Citations) உசாத்துணைப் பட்டியலை விதிகளின்படி உருவாக்கப் பயன்படும் பொதுவான பாணி எது?",
    topic: "மேற்கோள் நெறிமுறை (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "APA அல்லது MLA பாணி நெறிமுறைகள்", is_correct: true },
      { text: "செய்தித்தாள் நடைமுறை வடிவம்", is_correct: false },
      { text: "பொது அகராதி அகரவரிசை", is_correct: false },
      { text: "சமூக வலைதள குறிப்பு வடிவம்", is_correct: false },
    ],
  },
  {
    prompt: "முனைவர் பட்ட ஆராய்ச்சிக்குப் பிறகு ஒரு ஆய்வாளர் மேற்கொள்ளும் உயர்கல்வி ஆராய்ச்சி எவ்வாறு அழைக்கப்படுகிறது?",
    topic: "ஆராய்ச்சி நிலைகள் (Tamil)",
    difficulty: "EASY",
    options: [
      { text: "முனைவர் பட்டமேற்படிப்பு ஆராய்ச்சி (Post-Doctoral Fellowship - PDF)", is_correct: true },
      { text: "முதுகலை ஆராய்ச்சி (Master of Philosophy)", is_correct: false },
      { text: "பட்டப்படிப்பு திட்டப்பணி", is_correct: false },
      { text: "பள்ளி கல்வித் திட்டம்", is_correct: false },
    ],
  },
];

async function seedBilingualCommon() {
  console.log("=== SEEDING BILINGUAL COMMON CORE QUESTIONS ===");

  // 1. Insert English Common Questions
  console.log(`Seeding ${englishCommonQuestions.length} English Common Questions...`);
  for (const q of englishCommonQuestions) {
    const qPayload = {
      department_id: null, // Common Core
      topic: q.topic,
      difficulty: q.difficulty,
      question_type: "MCQ_SINGLE",
      prompt: q.prompt,
      default_points: 1.0,
      default_negative_points: 0.0,
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/department_questions`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(qPayload),
    });

    const [insertedQ] = await res.json();
    if (!insertedQ?.id) {
      console.error("Failed to insert English question:", q.prompt.slice(0, 30));
      continue;
    }

    const optionsPayload = q.options.map((opt, i) => ({
      question_id: insertedQ.id,
      option_text: opt.text,
      is_correct: opt.is_correct,
      order_index: i + 1,
    }));

    await fetch(`${supabaseUrl}/rest/v1/department_question_options`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(optionsPayload),
    });
  }

  // 2. Insert Tamil Common Questions
  console.log(`Seeding ${tamilCommonQuestions.length} Tamil Common Questions...`);
  for (const q of tamilCommonQuestions) {
    const qPayload = {
      department_id: null, // Common Core (Tamil Variant)
      topic: q.topic,
      difficulty: q.difficulty,
      question_type: "MCQ_SINGLE",
      prompt: q.prompt,
      default_points: 1.0,
      default_negative_points: 0.0,
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/department_questions`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(qPayload),
    });

    const [insertedQ] = await res.json();
    if (!insertedQ?.id) {
      console.error("Failed to insert Tamil question:", q.prompt.slice(0, 30));
      continue;
    }

    const optionsPayload = q.options.map((opt, i) => ({
      question_id: insertedQ.id,
      option_text: opt.text,
      is_correct: opt.is_correct,
      order_index: i + 1,
    }));

    await fetch(`${supabaseUrl}/rest/v1/department_question_options`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(optionsPayload),
    });
  }

  console.log("=== BILINGUAL SEEDING COMPLETED SUCCESSFULLY ===");
}

seedBilingualCommon();
