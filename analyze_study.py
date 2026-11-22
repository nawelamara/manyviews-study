"""Analysis of the Many Views online study (A single emotion / B fixed top 3 / C agreement-adaptive).

Usage:  python analyze_study.py study.xlsx          (the Google Sheet: File > Download > Microsoft Excel)
   or:  python analyze_study.py sessions.csv trials.csv responses.csv   (the three tabs downloaded as CSV)

The sheet has three tabs: sessions (one row per participant), trials (one row per painting), responses (everything else).
Only sessions with app_version >= MIN_VERSION are used (earlier versions measured things differently).

Plan (fixed before data collection):
  * Main comparison: C vs B (both give the same counts; only C adds a sentence about agreement).
  * A is the baseline = what a single-emotion description (today's audio guides) costs.
  * Main outcome (as in Budescu, Broomell & Por 2009, who asked for numbers): Q1 = "if 10 new people looked at this painting,
    how many would pick <the emotion most viewers chose>?" (0-10). Error = |answer - 10 x count / viewers|; bias = answer - true
    (above 0 = agreement over-estimated). "Close" (q1_correct) = error <= 1.
  * Second outcome per painting: Q2 source correct (viewers vs AI).
  * 12 paintings per person (3 parts of 4; 2 'leader' + 2 'varied' per part). One attention check after part 2.
  * Right after consent: age group, gender, art background. At the end: the three descriptions side by side with three choices: which one to read
    in a museum, which was hardest to understand, which leaves most room for own feelings. (Nov 22: confidence, numeracy
    and the ratings after each part were dropped to shorten the study.)
  * Also: Q1 in the first part only (before people can learn the pattern)
    and the three choices at the end.
  * Sessions are used only if finished and the attention check was passed.
  * Paintings are drawn at random from a pool for each participant; a mixed model treats them as random effects.
"""
import sys
import numpy as np
import pandas as pd

MIN_VERSION = "2026-11-22"
num = lambda s: pd.to_numeric(s, errors="coerce")
if len(sys.argv) == 2:
    xl = pd.read_excel(sys.argv[1], sheet_name=None)
    ses, tri, res = xl["sessions"], xl["trials"], xl["responses"]
else:
    ses, tri, res = (pd.read_csv(f) for f in sys.argv[1:4])
ses = ses.drop_duplicates("session_id", keep="last")
ses = ses[ses["app_version"].astype(str) >= MIN_VERSION]
print(f"Sessions of this version (app_version >= {MIN_VERSION}): {len(ses)}")
# one long table in the shape the analysis below uses (type / item / value as before, plus the trial columns)
tri = tri.drop_duplicates(["session_id", "block", "position"])
tri = tri.assign(type="trial", painting=tri["painting_id"], q1_answer=tri["q1_estimate"], q1_correct=tri["q1_close"],
                 item=tri["q2_asked_source"].astype(str) + ":" + tri["q2_asked_feeling"].astype(str), value="")
res = res.drop_duplicates(["session_id", "section", "block", "item"]).rename(columns={"section": "type"})
d = pd.concat([tri, res], ignore_index=True)
d = d.merge(ses[["session_id", "lang", "assigned_by", "order"]], on="session_id", how="inner")
fin = d.loc[d["type"] == "pref", "session_id"].unique()              # reached the end
print(f"Sessions in the sheet: {d['session_id'].nunique()} | finished: {len(fin)}")
d = d[d["session_id"].isin(fin)]
fail = d.loc[(d["type"] == "check") & (num(d["value"]) == 0), "session_id"].unique()
print(f"Failed an attention check (left out): {len(fail)}")
d = d[~d["session_id"].isin(fail)]
old = d.loc[d["category"] == "few", "session_id"].unique()   # sessions from the first version (with the dropped "too few" type)
if len(old): print(f"Sessions from the old version with 'too few' paintings (left out): {len(old)}")
d = d[~d["session_id"].isin(old)]
if "assigned_by" in d:
    prev = d.loc[d["assigned_by"].astype(str).str.endswith("preview"), "session_id"].unique()
    if len(prev): print(f"Preview (test) sessions left out: {len(prev)}")
    d = d[~d["session_id"].isin(prev)]
print("Sessions per language:", d.groupby("lang")["session_id"].nunique().to_dict())

t = d[d["type"] == "trial"].copy()
old_q = t.loc[num(t["q1_answer"]).isna(), "session_id"].unique()   # first versions asked Q1 as a category, not a number
if len(old_q): print(f"Sessions from versions with the category question (left out): {len(old_q)}")
t = t[~t["session_id"].isin(old_q)]; d = d[~d["session_id"].isin(old_q)]
t["block"] = num(t["block"])
import json as _json, os as _os, re as _re
_S = _json.loads(_re.search(r"window.STIMULI = (\{.*\});", open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "stimuli.js"), encoding="utf-8").read(), _re.S).group(1))
TRUE = {s["id"]: 10 * s["order"][0][1] / s["n"] for c in ["leader", "varied", "practice"] for s in _S.get(c, [])}
t["est"] = num(t["q1_answer"])
t["true10"] = t["painting"].map(TRUE)
t["err"] = (t["est"] - t["true10"]).abs()
t["bias"] = t["est"] - t["true10"]
print(f"Participants used: {t['session_id'].nunique()} | trials: {len(t)}")

def per_person(x):
    return x.groupby(["session_id", "condition"]).agg(err=("err", "mean"), bias=("bias", "mean"), close=("q1_correct", "mean"),
                                                       q2=("q2_correct", "mean")).reset_index()

pp = per_person(t)
print("\nMean per condition (err = mean distance from the true value, 0-10 scale; bias > 0 = agreement over-estimated;")
print("close = share within 1; q2 = share correct):")
print(pp.groupby("condition")[["err", "bias", "close", "q2"]].mean().round(3))
print("\nQ1 error and bias by painting type (leader / varied) and condition:")
print(t.pivot_table(index="category", columns="condition", values=["err", "bias"], aggfunc="mean").round(3))


first = t[t["block"] == 1]
print("\nFirst part only (each person saw one condition here; between-person comparison):")
print(first.groupby("condition")[["err", "bias", "q2_correct"]].mean().round(3))

# varied paintings: does it matter whether the 3 most chosen feelings point in the same or opposite directions?
import json, os, re
POS = {"gratitude", "happiness", "humility", "love", "optimism", "trust"}
NEG = {"anger", "arrogance", "disgust", "fear", "pessimism", "regret", "sadness", "shame"}
stim_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stimuli.js")
S = json.loads(re.search(r"window.STIMULI = (\{.*\});", open(stim_path, encoding="utf-8").read(), re.S).group(1))
direction = {}
for cat in ["leader", "varied", "practice"]:
    for s in S.get(cat, []):
        top3 = {f for f, c in s["order"][:3]}
        direction[s["id"]] = "opposite" if (top3 & POS and top3 & NEG) else "same"
t["direction"] = t["painting"].map(direction)
print("\nVaried paintings only: Q1 error by direction of the 3 most chosen feelings:")
print(t[t["category"] == "varied"].pivot_table(index="direction", columns="condition", values="err", aggfunc="mean").round(3))

print("\nPer painting (Q1 error by condition; paintings differ, so look for ones that behave very differently):")
print(t.pivot_table(index=["category", "painting"], columns="condition", values="err", aggfunc="mean").round(2).to_string())

try:   # paintings and participants as random effects (needs: pip install statsmodels)
    import statsmodels.formula.api as smf
    sub = t[t["condition"].isin(["B", "C"])].copy()
    m = smf.mixedlm("err ~ C(condition)", sub, groups=sub["session_id"], vc_formula={"painting": "0 + C(painting)"}).fit()
    print("\nMixed model, C vs B on Q1 error (random effects: participant and painting):")
    print(m.summary().tables[1])
except Exception as e:
    print(f"\n(Mixed model skipped: {e.__class__.__name__}. Install statsmodels to run it.)")

# ---- checks fixed before data collection (from the design review) ----
# 1. Practice description: B for participants 1-6, C for 7-12, B for 13-18, ... (the practice gives feedback, so it trains
#    one description). Report C vs B by which description was practised.
t["practised"] = t["participant"].map(lambda p: "C" if (int(p) - 1) // 6 % 2 else "B")
print("\nQ1 error by condition and by the description used in the practice:")
print(t.pivot_table(index="practised", columns="condition", values="err", aggfunc="mean").round(3))
# 2. Q2 overlap: the asked word also appears in the other list shown on screen. B and C show the same 3 viewer emotions, so
#    the overlap is identical for B and C (the C vs B test is fair); A shows one viewer emotion, so it differs for A only.
#    Rule fixed now: Q2 is reported on all trials and on trials without overlap.
VIEW = {}
for cat in ["leader", "varied", "practice"]:
    for s in S.get(cat, []):
        VIEW[s["id"]] = ([f for f, c in s["order"][:3]], s["model"][:3])
def overlap(row):
    side, word = str(row["item"]).split(":", 1)
    v3, m3 = VIEW[row["painting"]]
    shown = v3[:1] if row["condition"] == "A" else v3
    return int(word in (m3 if side == "people" else shown))
t["q2_overlap"] = t.apply(overlap, axis=1)
t["q2_side"] = t["item"].astype(str).str.split(":").str[0]
print("\nQ2 correct by condition, side asked and overlap (1 = the word was also in the other list):")
print(t.pivot_table(index=["q2_side", "q2_overlap"], columns="condition", values="q2_correct", aggfunc=["mean", "count"]).round(3))
print("\nQ2 correct by condition, trials without overlap only:")
print(t[t["q2_overlap"] == 0].groupby("condition")["q2_correct"].agg(["mean", "count"]).round(3))
# 3. The 'opposite directions' sentence is part of C only. Report C vs B on paintings with and without it.
t["opp_sentence"] = t["painting"].map(lambda i: direction.get(i) == "opposite")
print("\nQ1 error, B vs C, paintings with / without the 'opposite directions' sentence (C only shows it):")
print(t[t["condition"].isin(["B", "C"])].pivot_table(index="opp_sentence", columns="condition", values="err", aggfunc=["mean", "count"]).round(3))
# 4. About the participants (asked right after consent): age group, gender, art or design background
dm = d[d["type"] == "demo"].pivot_table(index="session_id", columns="item", values="value", aggfunc="first")
if len(dm):
    print("\nAge groups:", dm.get("age", pd.Series(dtype=str)).value_counts().to_dict())
    print("Art or design background:", dm.get("art_background", pd.Series(dtype=str)).value_counts().to_dict())
    print("Gender:", dm.get("gender", pd.Series(dtype=str)).value_counts().to_dict())
    pp["art"] = pp["session_id"].map(dm.get("art_background", pd.Series(dtype=str)))
    print("Q1 error by art background and condition:")
    print(pp.pivot_table(index="art", columns="condition", values="err", aggfunc="mean").round(3))

p = d[d["type"] == "pref"]
print("\nChoices at the end (share choosing each description; museum = would read, hard = hardest, room = most room for own feelings):")
print(pd.crosstab(p["item"], p["value"], normalize="index").round(3))

try:
    from scipy import stats
except ImportError:
    stats = None
print("\nPlanned paired comparisons (per-person means; Holm-corrected over the 6 tests). Main: C vs B on err.")
w = pp.pivot(index="session_id", columns="condition")
rows = []
for out in ["err", "bias", "q2"]:
    for a, b in [("C", "B"), ("C", "A")]:
        x = (w[(out, a)] - w[(out, b)]).dropna()
        dz = x.mean() / x.std(ddof=1) if len(x) > 1 and x.std(ddof=1) > 0 else np.nan
        pv = stats.ttest_1samp(x, 0).pvalue if stats is not None and len(x) > 1 else np.nan
        rows.append({"outcome": out, "comparison": f"{a} vs {b}", "n": len(x), "mean difference": round(x.mean(), 4), "dz": round(dz, 3), "p": pv})
res = pd.DataFrame(rows)
if stats is not None:
    order = res["p"].sort_values().index
    m, run = len(res), 0.0
    holm = {}
    for k, i in enumerate(order):
        run = max(run, min(1.0, (m - k) * res.loc[i, "p"]))
        holm[i] = run
    res["p (Holm)"] = pd.Series(holm)
print(res.round(4).to_string(index=False))

cm = d[d["type"] == "comment"]
if len(cm):
    print(f"\nComments ({len(cm)}): what was confusing")
    for _, x in cm.iterrows():
        print(f"  [{x.get('lang', '')}] {x['value']}")
