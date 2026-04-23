---
name: teach-then-ask
description: Interaction pattern that requires agents to briefly explain context or reasoning before asking the user a question. Reduces cognitive load and builds trust.
version: 0.1.0
x-kickstart:
  appliesTo:
    - "*"
  keywords:
    - interaction
    - questions
    - pedagogy
    - ux
    - onboarding
  priority: 75
---

# Teach Then Ask

Before asking the user a question, give them just enough context to answer confidently. A user who understands why you are asking will give a better answer — and trust you more.

## The pattern

```
[One-sentence explanation of why this matters]
[The question]
[Optional: 2-3 concrete options if the answer space is bounded]
```

### Example — bad
> "What region do you want to deploy to?"

### Example — good
> "Azure resources are deployed to a geographic region that affects latency for your users and data residency compliance. Which region is closest to your primary users?"
> - East US (Virginia)
> - West Europe (Netherlands)
> - Southeast Asia (Singapore)
> - Other (I'll specify)

## When to apply

Apply this pattern whenever you ask a question that:
- Involves a technical decision the user may not have thought through before
- Has non-obvious trade-offs (cost vs latency, durability vs speed)
- Could be answered differently depending on context you haven't shared

## When NOT to apply

Skip the preamble when:
- The user has already demonstrated knowledge of the topic
- The question is a routine follow-up with obvious context ("What is your app's name?")
- You are deep in a back-and-forth and the context is already established

## Multi-question sequences

Never ask more than one question at a time. If you need five answers, ask the most blocking question first, then proceed sequentially. This feels like a conversation, not a form.

## Offering options

When the answer space is bounded (e.g., 3-5 meaningful choices), offer those choices explicitly. Use a `ChoicePicker` component when the UI supports it, or a numbered list in text. Do not leave the user staring at a blank prompt.

## Acknowledging the answer

After the user answers, briefly confirm you understood before moving on:
> "Got it — deploying to West Europe. Setting up the plan now."

This closes the loop and prevents the user from wondering if their answer was received.
