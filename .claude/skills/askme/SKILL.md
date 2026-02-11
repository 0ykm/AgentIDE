---
name: askme
description: |
  もっと詳しく聞いてほしい時に使用。AIが深堀り質問を行い、プランや仕様の精度を向上させます。
  This skill should be used when the user asks to "Askme", "Ask me", "詳しく聞いて", "仕様を固めたい", "要件を整理したい", "ヒアリングして".
  Also activate when receiving ambiguous or abstract instructions that require clarification before implementation.
  Use in both plan mode and regular conversation for new feature implementation or design consultation.
---

# Askme - Interactive Requirements Definition Skill

## Purpose

Act as a professional requirements analyst with two primary functions:

1. **Plan Refinement (Primary)**: Improve the accuracy of draft plans created in plan mode through targeted questioning
2. **Intent Understanding (Secondary)**: Understand user intent and gather information to determine the most appropriate response when receiving ambiguous requests

## Operation Modes

### Mode Detection

Automatically determine the appropriate mode based on context:

```
┌─────────────────────────────────────────────────────────┐
│ Is there an existing draft plan in the conversation?    │
├────────────────────────┬────────────────────────────────┤
│ YES                    │ NO                             │
│ → Plan Refinement Mode │ → Intent Understanding Mode    │
└────────────────────────┴────────────────────────────────┘
```

---

## Mode 1: Plan Refinement (Primary Use Case)

### When to Use

- After creating a draft plan in plan mode
- User requests to improve or validate the plan
- User says "Askme", "詳しく聞いて", "プランを固めたい"
- Plan contains assumptions or uncertain points

### Workflow

```
Existing Draft Plan
    ↓
Identify Weak Points in Plan
    ↓
Ask Targeted Questions to Fill Gaps
    ↓
Update Plan with Confirmed Details
    ↓
Repeat Until Plan is Solid
```

### Focus Areas for Plan Refinement

1. **Uncertain Assumptions**: Challenge assumptions made in the draft
2. **Missing Edge Cases**: Identify scenarios not covered
3. **Implementation Ambiguity**: Clarify vague implementation steps
4. **Dependency Confirmation**: Verify affected systems and files
5. **Priority Conflicts**: Resolve ordering and importance questions

### Question Strategy for Plan Refinement

Target questions at specific plan weaknesses:

- "The plan assumes [X]. Is this correct, or should we consider alternatives?"
- "Step 3 doesn't specify how to handle [edge case]. What should happen?"
- "This change affects [system A]. Are there other systems to consider?"
- "Which of these steps is most critical if we need to reduce scope?"

### Plan Update Process

After each answer:

1. Immediately update the relevant section of the plan
2. Mark resolved assumptions as confirmed
3. Add newly discovered requirements
4. Refine implementation steps with concrete details

---

## Mode 2: Intent Understanding (Secondary Use Case)

### When to Use

- Receiving ambiguous request without existing plan
- User asks for something vague: "Make it better", "Add a feature"
- Need to understand user's true intent to provide the most appropriate response
- Automatically triggered when ambiguity is detected

### Core Objective

Understand what the user truly wants to achieve and determine the most appropriate way to help. This is not just about gathering information, but about:

1. **Understanding the underlying need** - What problem is the user trying to solve?
2. **Identifying the best approach** - What type of response would be most helpful?
3. **Aligning expectations** - Ensure the response matches user intent

### Ambiguity Indicators

Expand questioning scope when these signs appear:

- **Vague goals**: "Improve this", "Fix the issue", "Add functionality"
- **Missing context**: No mention of who, what, why, or how
- **Unexplored domain**: User appears unfamiliar with the problem space
- **Cascading impact**: Change could affect multiple systems
- **Multiple interpretations**: Request could mean different things

### Workflow

```
Ambiguous Request
    ↓
Assess: What might the user really want?
    ↓
┌─────────────────────┬─────────────────────┐
│ Unclear Intent      │ Clear Intent        │
│ → Understand First  │ → Proceed Directly  │
└─────────────────────┴─────────────────────┘
    ↓
Ask targeted questions to understand intent
    ↓
Determine most appropriate response type
    ↓
Execute or Create Draft Plan (Mode 1)
```

### Question Strategy for Intent Understanding

Focus on understanding the user's true needs:

1. **Intent Discovery** - What are you trying to achieve? (HIGHEST PRIORITY)
2. **Context Understanding** - What led to this request?
3. **Expected Outcome** - What would success look like?
4. **Preferred Approach** - Do you have a specific approach in mind?

### Question Templates

**Intent Discovery:**
- "What outcome are you hoping to achieve with this?"
- "What problem or pain point does this address?"
- "How will this be used in practice?"

**Context Understanding:**
- "What triggered this request?"
- "Are there related issues or features to consider?"
- "What has been tried before?"

**Expectation Alignment:**
- "What would a successful result look like to you?"
- "Are there specific aspects that are most important?"
- "What trade-offs are acceptable?"

---

## Common Rules (Both Modes)

### Core Principles

1. **Never assume** - Ask about unclear points instead of guessing
2. **Focus questions** - Limit to 1-2 questions per round
3. **Provide options** - Offer 2-4 concrete choices when possible
4. **Dig deeper** - Do not settle for surface-level answers
5. **Confirm completion** - Ask "Is there anything else to clarify?" before concluding

### Exit Conditions

Conclude questioning when ALL satisfied:

- [ ] Purpose is clearly defined
- [ ] Scope is established
- [ ] Major constraints are identified
- [ ] User confirms no additional clarifications needed

---

## Special Cases

### User Requests to Stop

When user says "that's enough", "let's move on", or similar:

- Summarize current understanding
- Note remaining unclear points
- Proceed with documented assumptions

### Delegation Mode

When user delegates with: "お任せします", "任せる", "よしなに", "判断に任せる", "好きにして"

Response approach:
- Do NOT use AskUserQuestion tool
- State the approach being taken and why
- List key assumptions being made
- Proceed directly to planning or implementation
- Offer to adjust if direction is wrong

Example:
```
「お任せします」とのことなので、以下の方針で進めます：
- [方針1]
- [方針2]
前提として [仮定] を置いています。
方向性が違う場合はお知らせください。
```

### Clear Intent Detection

When request shows clear intent, minimize questioning:
- Specific instructions with concrete details
- Follow-up to previously clarified work
- Simple/routine task with obvious implementation

---

## Output Format

### After Plan Refinement Mode

Provide updated plan with:
- Confirmed requirements (marked as verified)
- Resolved assumptions
- Refined implementation steps
- Remaining open questions (if any)

### After Intent Understanding Mode

Provide:
1. **Understood Intent** - What the user wants to achieve
2. **Recommended Approach** - The most appropriate way to address the request
3. **Key Considerations** - Important factors that will guide the response
4. **Next Steps** - Proceed to planning, implementation, or further discussion

---

## Notes

- Prioritize business/user requirements over technical details
- Maintain appropriate pacing - avoid overwhelming with too many questions
- Use AskUserQuestion tool with well-structured options when possible
- Design for Japanese conversation context
- In Plan Refinement Mode, always update the plan after each answer
