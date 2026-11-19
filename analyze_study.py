"""
Analysis of the description study (A single emotion / B fixed top 3 / C agreement-adaptive).
Run:  python app/study/analyze_study.py answers.csv
      (in-person version: the CSV exported from the study page; online version: the "answers" sheet downloaded as CSV)
Prints, per condition: the share of correct answers for the two main questions (recognising disagreement, telling viewers'
data from the model), the block ratings, and the SUS score; then the planned comparisons C vs A and C vs B on the
per-participant shares (paired t-test, Holm correction). The paper's main model (mixed-effects logistic regression with
participant and painting) is fitted separately; this script gives the quick, first look.
"""
import sys
import numpy as np
import pandas as pd

d = pd.read_csv(sys.argv[1])
d = d.drop_duplicates(["session_id", "type", "position", "block", "item"])
fin = d.loc[(d["type"] == "sus") & (d["item"] == "sus_score"), "session_id"].unique()
d = d[d["session_id"].isin(fin)]                         # finished sessions only
if "type" in d and (d["type"] == "check").any():          # online version: drop sessions that failed the attention check
    fail = d.loc[(d["type"] == "check") & (d["item"] == "attention_pass") & (d["value"].astype(float) == 0), "session_id"].unique()
    print(f"Failed the attention check (left out): {len(fail)}")
    d = d[~d["session_id"].isin(fail)]
if "lang" in d:
    print("Sessions per language:", d.groupby("lang")["session_id"].nunique().to_dict())
t = d[d["type"] == "trial"]
print(f"Finished sessions used: {d['session_id'].nunique()} | participants: {t['participant'].nunique()} | trials: {len(t)}")
print("Sessions per condition order:", t.groupby("order")["session_id"].nunique().to_dict())

per = t.groupby(["participant", "condition"])[["q1_correct", "q2_correct"]].mean().reset_index()
print("\nShare correct (mean over participants):")
print(per.groupby("condition")[["q1_correct", "q2_correct"]].mean().round(3).rename(
    columns={"q1_correct": "Q1 recognise disagreement", "q2_correct": "Q2 viewers vs model"}))
print("\nQ1 by condition and painting type:")
print(t.pivot_table(index="category", columns="condition", values="q1_correct", aggfunc="mean").round(3))

r = d[d["type"] == "rating"]
print("\nRatings (1-7), mean by condition:")
print(r.assign(value=r["value"].astype(float)).pivot_table(index="item", columns="condition", values="value", aggfunc="mean").round(2))
s = d[(d["type"] == "sus") & (d["item"] == "sus_score")]["value"].astype(float)
print(f"\nSUS score: mean {s.mean():.1f}, range {s.min():.0f}-{s.max():.0f} (n = {len(s)})")

try:
    from scipy import stats
except ImportError:
    stats = None
print("\nPlanned comparisons (paired, per-participant shares; Holm-corrected over the 4 tests):")
res = []
for q in ["q1_correct", "q2_correct"]:
    w = per.pivot(index="participant", columns="condition", values=q).dropna()
    for other in ["A", "B"]:
        diff = w["C"] - w[other]
        if stats:
            tt = stats.ttest_rel(w["C"], w[other])
            res.append([q, f"C vs {other}", len(w), diff.mean(), diff.mean() / diff.std(ddof=1) if diff.std(ddof=1) > 0 else np.nan, tt.pvalue])
        else:
            res.append([q, f"C vs {other}", len(w), diff.mean(), np.nan, np.nan])
out = pd.DataFrame(res, columns=["question", "comparison", "n", "mean difference", "dz", "p"])
if stats:
    order = np.argsort(out["p"].values); m = len(out); adj = np.empty(m); run = 0.0
    for rank, i in enumerate(order):
        run = max(run, (m - rank) * out["p"].values[i]); adj[i] = min(1.0, run)
    out["p (Holm)"] = adj
else:
    print("(scipy is not installed: install it for p-values)")
print(out.round(4).to_string(index=False))
