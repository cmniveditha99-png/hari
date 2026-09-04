# Hari's intake: setup (about 10 minutes)

What this gives you
- The page is served from Cloudflare at https://hari.cm-niveditha99.workers.dev
- His answers are stored on Cloudflare (KV), so they survive closed tabs, cleared browsers and other phones.
- Every time he taps **Save** under a question, you get an email (question number, section, progress).
  You also get one when he exports, and one if he clears everything.
- Only the question number is emailed. His actual answers stay on the page until he exports them.

## 1. Resend (the email sender)
1. Go to https://resend.com and sign up with **cm.niveditha99@gmail.com** (must be this address; the free
   sender `onboarding@resend.dev` can only email the account owner).
2. Left menu → **API Keys** → **Create API Key** → name it `hari-intake` → copy the key (starts with `re_`).

## 2. Cloudflare KV (the storage)
1. Cloudflare dashboard → **Storage & Databases** → **KV** → **Create a namespace** → name `hari-intake`.
2. Copy its **Namespace ID** (a long hex string).
3. Open `wrangler.jsonc` in this folder and replace `PASTE_YOUR_KV_NAMESPACE_ID_HERE` with that ID.

## 3. The secret
1. Dashboard → **Workers & Pages** → **hari** → **Settings** → **Variables and Secrets** → **Add**.
2. Type: **Secret**. Name: `RESEND_API_KEY`. Value: the `re_...` key from step 1. Save.

## 4. Build settings
1. Same Worker → **Settings** → **Build** (or **Builds**).
2. Build command: leave empty (or `npm install`).
3. Deploy command: `npx wrangler deploy`
4. Root directory: `/`

## 5. Push the files
Replace the contents of your GitHub repo with this folder, keeping the structure:

    wrangler.jsonc
    package.json
    public/index.html
    src/worker.js

Commit and push. Cloudflare builds and deploys automatically (watch **Deployments** in the Worker).

## 6. Test
1. Open https://hari.cm-niveditha99.workers.dev on your phone.
2. Type an answer, tap **Save**. Sparks fly; within a minute you get an email.
3. Close the tab, reopen (or open on another device). The answer is still there.

## Notes
- Emails per question are limited to one every 10 minutes so repeated taps don't flood you.
  Change `EMAIL_COOLDOWN_SECONDS` in `src/worker.js` if you want otherwise.
- The link is public, as you asked. Anyone with the URL can read and edit the same answers.
- Autosave runs 15 seconds after he stops typing (and whenever he leaves the page), which keeps you
  well inside the free KV limit of 1,000 writes a day.
- If you later verify your own domain in Resend, change `FROM_EMAIL` in `wrangler.jsonc`.
- The intro video and the background music stream from your R2 links; the reel sound is built into index.html, so nothing else needs uploading.
- Nothing plays until he taps the play button. That single tap is what lets the page start the music and the reel sound later on.
