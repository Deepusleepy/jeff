# Safety boundary

Jeff is an entertainment chatbot with a finite reply bank. It is not an
emergency, medical, mental-health, abuse-response, or legal service.

## What the code does

Before a model call, local rules look for selected phrases associated with:

- suicide and self-harm
- overdose or relapse
- abuse and immediate danger
- death and grief

A matched crisis or grief message receives a serious pre-written response. The
normal model-scored path also asks TypeSafe to classify distress, self-harm, and
threats toward another person. Local decision code gives those classifications
priority over ordinary reply fit.

The tests cover known phrases, punctuation variants, selected obfuscations,
false-positive guards, and the decision order. They verify only the listed
cases.

## Known limits

- A finite phrase list cannot cover every way a person describes danger.
- Multilingual deterministic coverage is limited to selected high-confidence
  phrases in a few languages.
- Slang, mixed languages, indirect wording, images, links, and unfamiliar
  obfuscation may bypass local rules.
- Model classifications and rankings can be wrong or can change with a model
  update.
- Conversation history is short and can omit context needed to understand risk.
- A false positive can return a serious line for a benign message.
- The built-in crisis text is not a worldwide resource directory. The suicide
  and self-harm lines identify 988 only for the US and Canada.
- The 500-character message limit can prevent a user from providing full
  context. The API rejects longer messages instead of silently shortening them.

Do not describe this system as fail-safe, complete, clinically validated, or a
replacement for human support.

## Rules for safety changes

When changing `lib/safety.js`, serious bank lines, model questions, thresholds,
history handling, or routing order:

1. Add a regression case that fails for the specific old behavior.
2. Add nearby benign wording to check for false positives.
3. Run the offline suite.
4. Read the resulting serious response as user-facing crisis copy, not only as
   a category assertion.
5. Run the live suite when the change depends on model classification. This
   spends account credits.
6. Review the complete decision order so self-harm cannot fall through to a
   threat, joke, refusal, or runner-up path.

Never weaken a serious route only to make a broad quality score look better.

## If you are in immediate danger

Contact local emergency services or a local crisis service. In the US and
Canada, call or text 988 for suicide and crisis support. See the official
[US 988 Lifeline](https://988lifeline.org/) and
[Canada 9-8-8 guidance](https://www.canada.ca/en/public-health/services/mental-health-services/mental-health-get-help.html).
If another person may monitor your device, use a safer device when possible.
