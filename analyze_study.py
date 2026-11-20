"""Analysis of the Many Views online study (A single emotion / B fixed top 3 / C agreement-adaptive).

Usage:  python analyze_study.py answers.csv      (the "answers" tab of the Google Sheet, downloaded as CSV)

Plan (fixed before data collection):
  * Main comparison: C vs B (both give the same counts; only C adds a sentence about agreement).
  * A is the baseline = what a single-emotion description (today's audio guides) costs.
  * Outcomes per painting: Q1 agreement correct, confidence in Q1 (1-7), Q2 source correct (people vs AI).
  * Also: Q1 in the first part only (before people can learn the pattern), confidence when right vs wrong
    (calibration), the two ratings per part, and the preference questions at the end.
  * Sessions are used only if finished and both attention checks were passed.
  * Paintings are drawn at random from a pool for each participant; a mixed model treats them as random effects.
"""
import sys
import numpy as np
import pandas as pd

d = pd.read_csv(sys.argv[1])
num = lambda s: pd.to_numeric(s, errors="coerce")
d = d.drop_duplicates(["session_id", "type", "position", "block", "item"])
fin = d.loc[d["type"] == "pref", "session_id"].unique()              # reached the end
print(f"Sessions in the sheet: {d['session_id'].nunique()} | finished: {len(fin)}")
d = d[d["session_id"].isin(fin)]
fail = d.loc[(d["type"] == "check") & (num(d["value"]) == 0), "session_id"].unique()
print(f"Failed an attention check (left out): {len(fail)}")
d = d[~d["session_id"].isin(fail)]
if "assigned_by" in d:
    prev = d.loc[d["assigned_by"].astype(str).str.endswith("preview"), "session_id"].unique()
    if len(prev): print(f"Preview (test) sessions left out: {len(prev)}")
    d = d[~d["session_id"].isin(prev)]
print("Sessions per language:", d.groupby("lang")["session_id"].nunique().to_dict())

t = d[d["type"] == "trial"].copy()
t["conf"] = num(t["value"])
t["block"] = num(t["block"])
print(f"Participants used: {t['session_id'].nunique()} | trials: {len(t)}")

def per_person(x):
    return x.groupby(["session_id", "condition"]).agg(q1=("q1_correct", "mean"), q2=("q2_correct", "mean"), conf=("conf", "mean")).reset_index()

pp = per_person(t)
print("\nMean per condition (share correct; confidence 1-7):")
print(pp.groupby("condition")[["q1", "q2", "conf"]].mean().round(3))
print("\nQ1 correct by painting type (leader / varied / few) and condition:")
print(t.pivot_table(index="category", columns="condition", values="q1_correct", aggfunc="mean").round(3))
print("\nWhat people answered to Q1, by condition (share of answers):")
print(pd.crosstab(t["condition"], t["q1_answer"], normalize="index").round(3))

print("\nCalibration: mean confidence when Q1 was right vs wrong:")
print(t.pivot_table(index="condition", columns="q1_correct", values="conf", aggfunc="mean").round(2).rename(columns={0: "wrong", 1: "right"}))

first = t[t["block"] == 1]
print("\nFirst part only (each person saw one condition here; between-person comparison):")
print(first.groupby("condition")[["q1_correct", "q2_correct", "conf"]].mean().round(3))

# varied paintings: does it matter whether the 3 most chosen feelings point in the same or opposite directions?
import json, os, re
POS = {"gratitude", "happiness", "humility", "love", "optimism", "trust"}
NEG = {"anger", "arrogance", "disgust", "fear", "pessimism", "regret", "sadness", "shame"}
stim_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stimuli.js")
S = json.loads(re.search(r"window.STIMULI = (\{.*\});", open(stim_path, encoding="utf-8").read(), re.S).group(1))
direction = {}
for cat in ["leader", "varied", "few"]:
    for s in S[cat]:
        top3 = {f for f, c in s["order"][:3]}
        direction[s["id"]] = "opposite" if (top3 & POS and top3 & NEG) else "same"
t["direction"] = t["painting"].map(direction)
print("\nVaried paintings only: Q1 correct by direction of the 3 most chosen feelings:")
print(t[t["category"] == "varied"].pivot_table(index="direction", columns="condition", values="q1_correct", aggfunc="mean").round(3))

print("\nPer painting (Q1 correct by condition; paintings differ, so look for ones that behave very differently):")
print(t.pivot_table(index=["category", "painting"], columns="condition", values="q1_correct", aggfunc="mean").round(2).to_string())

try:   # paintings and participants as random effects (needs: pip install statsmodels)
    import statsmodels.formula.api as smf
    sub = t[t["condition"].isin(["B", "C"])].copy()
    sub["q1"] = sub["q1_correct"].astype(float)
    m = smf.mixedlm("q1 ~ C(condition)", sub, groups=sub["session_id"], vc_formula={"painting": "0 + C(painting)"}).fit()
    print("\nMixed model, C vs B on Q1 (random effects: participant and painting):")
    print(m.summary().tables[1])
except Exception as e:
    print(f"\n(Mixed model skipped: {e.__class__.__name__}. Install statsmodels to run it.)")

r = d[d["type"] == "rating"]
print("\nRatings (1-7), mean by condition:")
print(r.assign(value=num(r["value"])).pivot_table(index="item", columns="condition", values="value", aggfunc="mean").round(2))

p = d[d["type"] == "pref"]
print("\nPreferences at the end (share choosing each description):")
print(pd.crosstab(p["item"], p["value"], normalize="index").round(3))

try:
    from scipy import stats
except ImportError:
    stats = None
print("\nPlanned paired comparisons (per-person means; Holm-corrected over the 6 tests). Main: C vs B.")
w = pp.pivot(index="session_id", columns="condition")
rows = []
for out in ["q1", "q2", "conf"]:
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
