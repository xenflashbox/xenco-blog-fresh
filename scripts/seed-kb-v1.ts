// scripts/seed-kb-v1.ts
// Seed KB v1 articles for resume-coach app
// Run with: npx tsx scripts/seed-kb-v1.ts

const KB_ARTICLES = [
  // --- Getting Started / Submit ---
  {
    appSlug: 'resume-coach',
    title: 'Upload a resume',
    summary: 'Learn how to upload your resume to ResumeCoach for analysis. We support PDF, DOC, DOCX, and TXT files up to 5MB. Most resumes are processed within 30 seconds.',
    stepsText: '1. Click the "Upload Resume" button on the dashboard. 2. Select your resume file from your computer (PDF, DOC, DOCX, or TXT). 3. Wait for the upload progress bar to complete. 4. Your resume will automatically begin processing.',
    triggersText: 'upload resume submit file attach document PDF DOC DOCX TXT how to upload where to upload drag drop file size limit supported formats file types',
    routes: [{ route: '/dashboard' }, { route: '/submit' }, { route: '/upload' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Copy and paste resume text',
    summary: 'You can paste your resume text directly instead of uploading a file. This works well for plain text resumes or when you want to test specific sections.',
    stepsText: '1. Click "Paste Text" or "Copy/Paste" option on the submit page. 2. Open your resume in another application. 3. Select all text (Ctrl+A or Cmd+A) and copy (Ctrl+C or Cmd+C). 4. Paste into the text area (Ctrl+V or Cmd+V). 5. Click "Analyze" to submit.',
    triggersText: 'copy paste text resume content manual entry type resume paste text area formatting lost copy resume text plain text',
    routes: [{ route: '/dashboard' }, { route: '/submit' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Fix upload errors',
    summary: 'Common upload errors include unsupported file types, files too large, or corrupted files. Here\'s how to troubleshoot upload issues.',
    stepsText: '1. Check file format - we support PDF, DOC, DOCX, TXT only. 2. Check file size - maximum is 5MB. 3. Try a different browser (Chrome recommended). 4. Clear browser cache and try again. 5. If PDF fails, try saving as DOCX first. 6. Contact support if issue persists.',
    triggersText: 'upload failed error upload not working file rejected invalid file format unsupported file type file too large upload stuck upload error message cannot upload won\'t upload',
    routes: [{ route: '/submit' }, { route: '/upload' }, { route: '/dashboard' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Find your results after submission',
    summary: 'After submitting your resume, results appear on the Results page. Processing typically takes 30-60 seconds. You\'ll see a score and detailed feedback.',
    stepsText: '1. After upload, you\'ll be redirected to the Results page automatically. 2. If not redirected, click "My Results" or "Dashboard" in the navigation. 3. Your most recent analysis appears at the top. 4. Click on any result to see detailed feedback.',
    triggersText: 'where are my results find results see analysis view score results page dashboard my resumes where did my resume go can\'t find results lost results',
    routes: [{ route: '/results' }, { route: '/dashboard' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Understanding your resume score',
    summary: 'Your resume score (0-100) measures ATS compatibility, keyword optimization, formatting, and content quality. Higher scores mean better chances of passing automated screening.',
    stepsText: '1. Overall Score: 0-100 rating of your resume\'s effectiveness. 2. ATS Score: How well automated systems can parse your resume. 3. Keyword Match: How well your resume matches job requirements. 4. Format Score: Layout, readability, and professional appearance. 5. Content Score: Quality of your achievements and descriptions.',
    triggersText: 'what does score mean how scoring works resume score explained ATS score keyword score format score bad score low score improve score what is a good score score breakdown rating meaning',
    routes: [{ route: '/results' }, { route: '/dashboard' }],
  },

  // --- Account / Access ---
  {
    appSlug: 'resume-coach',
    title: 'Sign in to your account',
    summary: 'Sign in using your email and password, or use Google/LinkedIn single sign-on. Your resume history and settings are saved to your account.',
    stepsText: '1. Click "Sign In" in the top right corner. 2. Enter your email address. 3. Enter your password. 4. Click "Sign In" button. 5. Alternatively, click "Sign in with Google" or "Sign in with LinkedIn".',
    triggersText: 'sign in login log in access account enter site authentication SSO Google login LinkedIn login cannot sign in login page where to login',
    routes: [{ route: '/login' }, { route: '/signin' }, { route: '/' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Reset your password',
    summary: 'Forgot your password? Request a password reset link via email. The link expires after 24 hours.',
    stepsText: '1. Click "Sign In" then "Forgot Password". 2. Enter your email address. 3. Click "Send Reset Link". 4. Check your email (and spam folder). 5. Click the reset link in the email. 6. Enter and confirm your new password.',
    triggersText: 'forgot password reset password change password password recovery can\'t remember password lost password new password password link not working',
    routes: [{ route: '/login' }, { route: '/forgot-password' }, { route: '/reset-password' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Account not recognized or email mismatch',
    summary: 'If you see "account not found" or can\'t sign in, you may have registered with a different email or login method (Google vs email).',
    stepsText: '1. Try all email addresses you might have used. 2. Check if you signed up with Google or LinkedIn instead. 3. Try the "Forgot Password" flow to verify email exists. 4. Check for typos in your email. 5. Contact support with your original signup email.',
    triggersText: 'account not found email not recognized wrong email different email can\'t find account no account email mismatch signed up with wrong email google account email',
    routes: [{ route: '/login' }, { route: '/signin' }],
  },

  // --- Billing ---
  {
    appSlug: 'resume-coach',
    title: 'Billing plans and pricing FAQ',
    summary: 'ResumeCoach offers free and premium plans. Premium includes unlimited analyses, advanced feedback, and priority support. Plans are billed monthly or annually.',
    stepsText: '1. Free Plan: 3 resume analyses per month, basic feedback. 2. Pro Plan: Unlimited analyses, detailed AI feedback, priority support. 3. View current pricing at /pricing or in account settings. 4. Annual billing saves 20% compared to monthly.',
    triggersText: 'pricing plans cost how much subscription free trial premium pro plan billing FAQ what\'s included features comparison upgrade plan',
    routes: [{ route: '/pricing' }, { route: '/billing' }, { route: '/account' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Update your payment method',
    summary: 'Change your credit card or payment method in the Billing section of your account settings. Changes apply to your next billing cycle.',
    stepsText: '1. Click your profile icon in the top right. 2. Select "Account Settings" or "Billing". 3. Find "Payment Method" section. 4. Click "Update" or "Change Card". 5. Enter new card details. 6. Click "Save" to confirm.',
    triggersText: 'update card change card new credit card payment method edit payment card expired update billing card declined change payment',
    routes: [{ route: '/billing' }, { route: '/account' }, { route: '/settings' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Cancel subscription or request refund',
    summary: 'Cancel your subscription anytime from account settings. Refunds are available within 7 days of purchase if you haven\'t used premium features.',
    stepsText: '1. Go to Account Settings > Billing. 2. Click "Cancel Subscription". 3. Confirm cancellation (you keep access until period ends). 4. For refunds: email support@resumecoach.me within 7 days of purchase. 5. Include your account email and reason.',
    triggersText: 'cancel subscription unsubscribe stop billing refund money back cancel account delete account end subscription stop charging',
    routes: [{ route: '/billing' }, { route: '/account' }, { route: '/settings' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Download invoice or receipt',
    summary: 'Download invoices and receipts for your subscription payments from the Billing section. All past invoices are available for download as PDF.',
    stepsText: '1. Go to Account Settings > Billing. 2. Scroll to "Billing History" or "Invoices". 3. Find the invoice you need. 4. Click "Download" or the PDF icon. 5. Invoice downloads as PDF to your device.',
    triggersText: 'invoice receipt download billing history payment proof tax receipt expense report PDF invoice get receipt billing statement',
    routes: [{ route: '/billing' }, { route: '/account' }],
  },

  // --- Common "Bugs" Users Report ---
  {
    appSlug: 'resume-coach',
    title: 'Fix stuck spinning or processing forever',
    summary: 'If your resume is stuck processing for more than 2 minutes, try refreshing the page. Normal processing takes 30-60 seconds. Extended delays may indicate a temporary server issue.',
    stepsText: '1. Wait at least 60 seconds - processing takes time. 2. If stuck over 2 minutes, refresh the page (F5 or Ctrl+R). 3. Check your internet connection. 4. Try a different browser. 5. Re-upload your resume. 6. If still stuck, submit a support ticket.',
    triggersText: 'stuck spinning loading forever processing taking too long infinite loop never finishes hang frozen loading wheel progress stuck waiting too long',
    routes: [{ route: '/results' }, { route: '/submit' }, { route: '/dashboard' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Fix white screen or blank page',
    summary: 'A blank or white page usually means a browser compatibility issue or JavaScript error. Try refreshing, clearing cache, or using a different browser.',
    stepsText: '1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac). 2. Clear browser cache and cookies for this site. 3. Disable browser extensions (especially ad blockers). 4. Try Incognito/Private mode. 5. Try Chrome or Firefox if using another browser. 6. Contact support if issue persists.',
    triggersText: 'white screen blank page nothing showing empty page page won\'t load white page black screen page broken no content displays nothing appears',
    routes: [{ route: '*' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Fix 500 or 404 errors',
    summary: 'A 500 error means a server-side issue - please try again in a few minutes. A 404 error means the page doesn\'t exist - check the URL or navigate from the homepage.',
    stepsText: '1. For 500 errors: Wait 2-3 minutes and try again. 2. For 404 errors: Check URL for typos, go to homepage. 3. Clear browser cache and refresh. 4. If 500 error persists over 10 minutes, submit a support ticket. 5. Include the exact URL and what you were trying to do.',
    triggersText: '500 error 404 error server error page not found internal server error something went wrong oops error technical difficulties error page HTTP error',
    routes: [{ route: '*' }],
  },
  {
    appSlug: 'resume-coach',
    title: 'Fix connection errors or failed to fetch',
    summary: 'Connection errors usually indicate network issues on your end or temporary server maintenance. Check your internet connection and try again.',
    stepsText: '1. Check your internet connection (try loading another website). 2. Disable VPN if using one. 3. Try a different network (mobile data vs WiFi). 4. Wait a few minutes and retry. 5. Check status.resumecoach.me for outage info. 6. Submit ticket if problem persists.',
    triggersText: 'failed to fetch cannot connect connection error network error timeout connection refused no internet offline server unreachable connection lost',
    routes: [{ route: '*' }],
  },

  // --- Privacy / Security ---
  {
    appSlug: 'resume-coach',
    title: 'Data privacy and security overview',
    summary: 'Your resume data is encrypted in transit and at rest. We retain resumes for 90 days for your convenience, then auto-delete. You can request immediate deletion anytime.',
    stepsText: '1. All data transmitted via HTTPS (encrypted). 2. Resumes stored encrypted on secure servers. 3. We never share your data with third parties without consent. 4. Auto-deletion after 90 days of inactivity. 5. Request immediate deletion via Account Settings or support.',
    triggersText: 'privacy data security what do you store how long keep data delete my data GDPR data protection encrypted secure personal information data retention',
    routes: [{ route: '/privacy' }, { route: '/account' }, { route: '/settings' }],
  },
]

async function seedKBArticles() {
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

  for (const article of KB_ARTICLES) {
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
  console.log(`Total: ${KB_ARTICLES.length}`)
}

seedKBArticles()
