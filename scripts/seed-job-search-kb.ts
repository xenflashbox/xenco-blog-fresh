// scripts/seed-job-search-kb.ts
// Seed Job Search KB articles for resume-coach app
// Run with: npx tsx scripts/seed-job-search-kb.ts

const JOB_SEARCH_KB_ARTICLES = [
  {
    appSlug: 'resume-coach',
    title: 'Job Search Strategy Tips',
    summary: 'ResumeCoach focuses on optimizing your resume to pass ATS screening and get interviews. For general job searching strategy, we recommend checking out reputable job boards like LinkedIn, Indeed, and Glassdoor. Tailor each resume to the specific job description using our analysis tool.',
    stepsText: '1. Use ResumeCoach to analyze your resume for ATS compatibility. 2. Review the keyword match score and add missing relevant keywords. 3. Apply to jobs through major job boards (LinkedIn, Indeed, Glassdoor). 4. Customize your resume for each application using our feedback. 5. Track your applications and follow up after 1-2 weeks.',
    triggersText: 'job search how to find jobs where to apply job boards linkedin indeed glassdoor job hunting career advice job seeking employment search best job sites',
    routes: [{ route: '/dashboard' }, { route: '/results' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'ATS Keyword Optimization for Job Matching',
    summary: 'Applicant Tracking Systems (ATS) scan resumes for keywords from job descriptions. ResumeCoach analyzes your resume against common ATS requirements and shows which keywords you\'re missing. Higher keyword match scores mean better chances of passing automated screening.',
    stepsText: '1. Upload your resume to get your keyword match score. 2. Review the "Missing Keywords" section in your analysis. 3. Add relevant keywords naturally to your experience sections. 4. Re-upload and verify your score improved. 5. Repeat for each job application with different requirements.',
    triggersText: 'ATS applicant tracking system keywords job matching job description match resume keywords optimize for ATS beat the ATS keyword optimization resume screening automated screening',
    routes: [{ route: '/results' }, { route: '/dashboard' }],
  },
]

async function seedJobSearchKB() {
  const baseUrl = process.env.PAYLOAD_URL || 'https://cms.resumecoach.me'

  // Login to get token
  console.log('Logging in to Payload...')
  const loginRes = await fetch(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.PAYLOAD_ADMIN_EMAIL,
      password: process.env.PAYLOAD_ADMIN_PASSWORD,
    }),
  })

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text())
    process.exit(1)
  }

  const { token } = await loginRes.json()
  console.log('Logged in successfully')

  let created = 0
  let failed = 0

  for (const article of JOB_SEARCH_KB_ARTICLES) {
    try {
      const res = await fetch(`${baseUrl}/api/support_kb_articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `JWT ${token}`,
        },
        body: JSON.stringify({
          ...article,
          _status: 'published',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        console.log(`✓ Created: ${article.title} (ID: ${data.doc.id})`)
        created++
      } else {
        const error = await res.text()
        console.error(`✗ Failed: ${article.title}`, error)
        failed++
      }
    } catch (err) {
      console.error(`✗ Error: ${article.title}`, err)
      failed++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Created: ${created}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${JOB_SEARCH_KB_ARTICLES.length}`)
}

seedJobSearchKB()
