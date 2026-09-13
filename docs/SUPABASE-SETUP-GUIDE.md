# Supabase Setup — ek dafa ka kaam, 9 tabs unlock karega

Ye guide karein taake Keyword Research, Competitor Intelligence, Content
Strategy, Technical SEO, Internal Linking, Local SEO, SEO Experiments,
AI Strategist, aur AI Operating System — sab kaam karna shuru kar dein.

## Step 1: Supabase account aur project banayein

1. **supabase.com** pe jayein, free account banayein (GitHub se bhi sign up
   ho sakta hai).
2. "New Project" dabayein.
3. Project ka naam dein (jaise "autoseo"), ek strong database password
   set karein (isay kahin save kar lein), region select karein (koi bhi
   qareeb wala, jaise Singapore ya Mumbai agar available ho).
4. "Create new project" dabayein — 1-2 minute lagenge setup hone mein.

## Step 2: Credentials nikalein

Project ready hone ke baad:

1. Left sidebar mein **Settings** (gear icon) → **API** pe jayein.
2. Yahan se ye 3 cheezein copy karein:
   - **Project URL** (jaise `https://xxxxx.supabase.co`)
   - **anon public** key (lambi string)
   - **service_role** key (ek aur lambi string — ⚠️ ye secret hai, kabhi
     bhi client-side code ya public repo mein na jaye)

## Step 3: Database migrations run karein

1. Left sidebar mein **SQL Editor** pe jayein.
2. "New query" dabayein.
3. Is project ki `supabase/COMBINED-MIGRATION.sql` file kholein, poora
   content copy karein, aur SQL Editor mein paste kar dein.
4. **Run** dabayein (ya Ctrl+Enter).
5. Agar "Success" jaisa message aaye, schema through V44 apply ho gayi
   hai (V38/V43 ke SQL files nahi hain — wo application-only versions
   hain). Agar koi error aaye, uska text share karein. Apply karne se
   pehle backup lein; ye file existing data delete nahi karti.

## Step 4: .env.local update karein

Apni `.env.local` file mein ye 3 lines add/update karein:

```
NEXT_PUBLIC_SUPABASE_URL=<Step 2 wala Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Step 2 wali anon key>
SUPABASE_SERVICE_ROLE_KEY=<Step 2 wali service_role key>
```

`AUTOSEO_AUTH_REQUIRED=false` hi rehne dein abhi — isay `true` sirf tab
karein jab login poori tarah test ho chuka ho.

## Step 5: Server restart karein aur sign up karein

1. `npm run dev` dobara chalayein (agar chal raha ho to pehle rokein).
2. Browser mein `localhost:3000` refresh karein — ab **login screen
   dikhni chahiye** (kyunke Supabase configured ho gaya hai).
3. "Sign up" se ek naya account banayein (apna email/password).
4. Login hone ke baad, **"Overview & Settings"** category mein jayein aur
   ek **Workspace banayein** (agar UI mein wo option dikhe) — ye zaroori
   hai kyunke naye tools "workspace" ke andar kaam karte hain.

## Step 6: Test karein

Ab Keyword Research, Content Strategy, Technical SEO, waghera tabs test
karein — 401 errors nahi aani chahiyen.

---

**Note:** Ye Supabase ka **free tier** kaafi hai testing ke liye (500MB
database, 50,000 monthly active users) — koi cost nahi lagega abhi.
