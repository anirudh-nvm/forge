# Decision: Context Before AI


## Problem


Many apps rush to add AI features without first establishing proper state management and data architecture. This leads to fragmented data, inconsistent state, and AI that can't make informed decisions.


## Options Considered


1. **AI-first** — Add AI immediately and build state around it
2. **State-first** — Establish proper state management before adding AI
3. **Context-first** — Create a single source of truth that AI can read from and write to


## Decision


We chose **context-first**. Before introducing any AI capabilities, we established a proper state architecture using React Context. This ensures AI has a clean, typed data source to work with.


## Reasoning


- AI needs structured data to make good decisions
- State management is foundational to app architecture
- Context provides a single source of truth
- Types define the contract between AI and the app
- Proper state makes AI features easier to implement and debug


## Trade-offs


- More upfront work before seeing AI results
- Requires discipline to maintain the architecture
- May feel slow for rapid prototyping


## Future Impact


This decision makes AI integration straightforward. The `TodayPlan` type defines exactly what AI needs to produce. The context provides the state management. The screens are already designed to handle loading, empty, and data states. AI can be added by simply updating the `ConversationScreen` to call an AI service instead of using placeholder data.
