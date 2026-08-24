import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
    },

    operations: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "add_transaction",
              },
              transaction: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: ["expense", "income"],
                  },
                  amount: {
                    type: "number",
                  },
                  category: {
                    type: "string",
                  },
                  merchant: {
                    type: ["string", "null"],
                  },
                  accountName: {
                    type: ["string", "null"],
                  },
                  date: {
                    type: "string",
                  },
                  note: {
                    type: ["string", "null"],
                  },
                },
                required: [
                  "type",
                  "amount",
                  "category",
                  "merchant",
                  "accountName",
                  "date",
                  "note",
                ],
              },
            },
            required: ["type", "transaction"],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "update_transaction",
              },
              transactionId: {
                type: "string",
              },
              patch: {
                type: "object",
                additionalProperties: false,
                properties: {
                  amount: {
                    type: ["number", "null"],
                  },
                  category: {
                    type: ["string", "null"],
                  },
                  merchant: {
                    type: ["string", "null"],
                  },
                  accountName: {
                    type: ["string", "null"],
                  },
                  date: {
                    type: ["string", "null"],
                  },
                  note: {
                    type: ["string", "null"],
                  },
                },
                required: [
                  "amount",
                  "category",
                  "merchant",
                  "accountName",
                  "date",
                  "note",
                ],
              },
            },
            required: ["type", "transactionId", "patch"],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "delete_transaction",
              },
              transactionId: {
                type: "string",
              },
            },
            required: ["type", "transactionId"],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "set_budget",
              },
              category: {
                type: "string",
              },
              amount: {
                type: "number",
              },
            },
            required: ["type", "category", "amount"],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "add_goal",
              },
              name: {
                type: "string",
              },
              target: {
                type: "number",
              },
              saved: {
                type: "number",
              },
              targetDate: {
                type: ["string", "null"],
              },
            },
            required: [
              "type",
              "name",
              "target",
              "saved",
              "targetDate",
            ],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "update_goal",
              },
              goalName: {
                type: "string",
              },
              saved: {
                type: ["number", "null"],
              },
              target: {
                type: ["number", "null"],
              },
              targetDate: {
                type: ["string", "null"],
              },
            },
            required: [
              "type",
              "goalName",
              "saved",
              "target",
              "targetDate",
            ],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "remember_category",
              },
              merchant: {
                type: "string",
              },
              category: {
                type: "string",
              },
            },
            required: ["type", "merchant", "category"],
          },

          {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                const: "none",
              },
            },
            required: ["type"],
          },
        ],
      },
    },
  },

  required: ["reply", "operations"],
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 500 });
    const { message, state } = await req.json();
    const now = new Date();
    const today = now.toISOString().slice(0,10);
    const compactState = {
      accounts: state.accounts,
      transactions: state.transactions.slice(0,250),
      budgets: state.budgets,
      goals: state.goals,
      preferences: state.preferences,
      recentConversation: state.messages?.slice(-10),
    };

    const instructions = `You are Wallet, a decisive personal finance assistant inside a private expense tracker.
Current date: ${today}. Currency: SGD.

PERMANENT USER DEFAULTS:
- If a transaction date is not stated, use TODAY (${today}). Never ask for the date merely because it was omitted.
- Default payment account is Main Bank.
- "card", "credit card", "debit card", "PayNow", "bank", and ordinary unspecified payments mean Main Bank unless the user explicitly names another account.
- Use Cash Wallet only if the user explicitly says cash.
- For questions with no time range, default to THIS MONTH.
- Follow-up questions inherit the previous conversational time range/topic when obvious.
- Infer categories sensibly (restaurant/coffee/groceries -> Food & Dining, Grab/MRT/taxi -> Transport, etc.). Use categoryMemory if available.
- Never ask for information that can be reasonably inferred from these defaults.
- Ask a clarification only when a genuinely material ambiguity remains, e.g. no amount for a transaction.
- For financial questions, compute from the provided state. Do not invent transactions.
- When the user asks to create/update/delete a transaction, budget or goal, return the corresponding operation(s).
- When editing/deleting, identify the target from provided transaction IDs and context. If multiple plausible matches exist, ask rather than guessing.
- For budgeting advice, be practical and concise. You may recommend budgets without applying them; only return set_budget operations when the user clearly asks to create/set/apply a budget.
- If user teaches a merchant category (e.g. "Starbucks is Food"), save it with remember_category.
- Be conversational, clear and brief. Confirm completed actions with amount/category/account/date.

State follows. Transaction IDs are authoritative:
${JSON.stringify(compactState)}`;

    const response = await openai.responses.create({
      model: "gpt-5.6",
      instructions,
      input: message,
      text: {
        format: {
          type: "json_schema",
          name: "wallet_agent_response",
          strict: true,
          schema: responseSchema,
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    // Strip null fields in patches so null never overwrites stored values.
    parsed.operations = parsed.operations.map((op:any) => {
      if(op.type === "update_transaction") op.patch = Object.fromEntries(Object.entries(op.patch).filter(([,v])=>v!==null));
      if(op.type === "add_transaction") op.transaction = Object.fromEntries(Object.entries(op.transaction).filter(([,v])=>v!==null));
      if(op.type === "add_goal" && op.targetDate === null) delete op.targetDate;
      if(op.type === "update_goal") Object.keys(op).forEach(k=>{if(op[k]===null) delete op[k]});
      return op;
    });
    return NextResponse.json(parsed);
  } catch (error:any) {
    console.error(error);
    return NextResponse.json({ error: error?.message || "Agent failed" }, { status: 500 });
  }
}
