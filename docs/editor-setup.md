# Turning on the editor for Ben

The editor at `/keystatic` saves by committing to the GitHub repository
`benbroomewebsite/benbroomeportfolio`. Ben signs in with his own GitHub account. He
never needs access to Vercel or to the R2 media bucket: Vercel redeploys on
every commit, and the images stay where they are.

## One-time setup (Daniel)

1. **Invite Ben to the repository.** GitHub → the repository → Settings →
   Collaborators → Add people → Ben's GitHub username. He accepts the email
   invitation.
2. **Create the GitHub sign-in app.** In `.env.local` add
   `NEXT_PUBLIC_KEYSTATIC_STORAGE=github`, run `pnpm dev`, and open
   http://localhost:3000/keystatic. Follow the prompt to create a GitHub App;
   when asked for the deployed URL, enter
   `https://benbroomeportfolio-two.vercel.app`. It writes four values into `.env`:
   `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
   `KEYSTATIC_SECRET` and `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`.
3. **Install the app on the repository** when GitHub offers to, choosing only
   `benbroomeportfolio`.
4. **Copy the settings to Vercel.** Project → Settings → Environment Variables:
   add those four values plus `NEXT_PUBLIC_KEYSTATIC_STORAGE=github`, then
   redeploy.

## Check before relying on it

Vercel's free Hobby plan does not deploy commits to a **private** repository
when the commit author is not the Vercel account owner. The repository is now
public, so Ben's saves deploy.

## What Ben does

Open `https://benbroomeportfolio-two.vercel.app/keystatic`, sign in with GitHub,
pick a project, change it, press Save. The site updates a minute or two later.
New images and PDFs uploaded in the editor are stored in the repository under
`public/uploads/` and need no further step.

If the editor offers a branch menu, stay on **main**. A save made on another
branch is merged into main automatically (see the README), but main is where
the current content is.
