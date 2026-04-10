# Orchestration: Fry — B-20 Past-Turn Isolation Guards

**Timestamp:** 2026-04-09T20:26:47Z  
**Agent:** Fry (Frontend Dev)  
**Task:** B-20 Past-turn isolation guards  
**Status:** ✅ Complete

## Outcome

- **isActive prop** added to turn containers — distinguishes current turn from history
- **Past turns** rendered as dimmed/read-only visual state
- **Latest turn** remains fully interactive (input focus, action handlers active)
- **Component isolation** prevents accidental interaction with historical UI state
- **Pushed:** Yes

## Notes

- Part of P1 phase continuation (started with B-10, B-11, B-16, B-20)
