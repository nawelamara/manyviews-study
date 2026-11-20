# Many Views – online study (4 languages)

A public web page for the description study (A single emotion / B fixed top 3 / C agreement-adaptive), in English,
Traditional Chinese, French and Arabic. Anonymous answers go to a Google Sheet you own.

**The page is closed (`OPEN: false` in `config.js`) until the ethics review or exemption is approved and the supervisor agrees.**
While closed, you can still test it with `?preview=1` at the end of the address (answers in preview are marked, and no
participant number is taken from the sheet).

## What participants see (about 20 minutes, phone or computer)
Language → information + consent (18 or older, agree) → how it works → 2 practice paintings → 18 paintings in 3 parts →
2 ratings after each part (+ 1 attention check after part 2: "please choose 2") → thank you (+ completion code).
Per painting: look (optional emotion buttons, not saved) → read the description and the labelled model prediction →
the text is hidden → Q1 "how did earlier viewers respond?" and Q2 "which emotion did they select most often?".

## Set it up (once)
1. **Google Sheet** (use the lab's or supervisor's Google account if possible): create a new Sheet, name it
   "Many Views study answers". Extensions → Apps Script → delete the example code → paste `Code.gs` → Save.
2. **Deploy**: Deploy → New deployment → type **Web app** → Execute as **Me** → Who has access **Anyone** → Deploy →
   allow the permissions → copy the **Web app URL**.
3. **config.js**: paste the URL as `ENDPOINT`. Add `CONTACT` (an e-mail agreed with the supervisor) and, if you use
   SurveyCircle, its code as `COMPLETION_CODE`. Leave `OPEN: false` for now.
4. **Put the page online (free)**, either:
   - **Netlify Drop**: go to app.netlify.com/drop, drag the whole `study_online` folder in → you get a link
     (rename the site in Site settings, e.g. `manyviews-study.netlify.app`); or
   - **GitHub Pages**: a new **public** repository with only this folder's files → Settings → Pages → deploy from `main`.
   The folder contains only public-domain images and published dataset counts — no ArtEmis, no individual answers.
5. **Test**: open the link with `?preview=1`, do one full run in each language, check the rows appear in the sheet
   ("answers" tab), then delete those test rows and reset the participant counter
   (Apps Script → Project Settings → Script properties → delete `next` and the `n_…` entries).

## Open it (only after approval)
Set `OPEN: true` in `config.js`, upload the folder again (step 4). Share the link; add `?lang=zh-Hant`,
`?lang=fr` or `?lang=ar` to open in that language (e.g. Chinese link for Taiwanese groups).

## Balance
The sheet hands out participant numbers 1, 2, 3, … → 6 condition orders × 3 painting rotations repeat every 18 people.
Aim for **54 finished sessions** after removing attention-check failures (people who stop early leave gaps; that's fine).

## Analysis
In the sheet: File → Download → CSV (the "answers" tab) → `python analyze_study.py answers.csv`.
It removes unfinished sessions and attention-check failures and prints the results per condition and per language.

## Before opening — checklist
- [ ] Ethics approval / exemption; supervisor agrees; the online version (public recruitment, Google Sheet) is in the application
- [ ] Translations checked by a native speaker (zh-Hant, fr, ar)
- [ ] `CONTACT` filled in; consent text approved by the ethics committee
- [ ] Test run in every language; test rows deleted; counter reset
- [ ] 5-person pilot (in preview or a separate sheet), then fix anything unclear
