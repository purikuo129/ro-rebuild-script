# Ragnarok Web Assist

Tampermonkey assistant for the Ragnarok Rebuild web client. It observes live game packets and coordinates player automation, navigation, and the HUD.

## Language

**Activity Journal**:
The in-game record of activity, debug, and important entries shown to the player. It is distinct from the browser console and remote alerts.
_Avoid_: Log buffer, popup log

**Movement Planner**:
The part of the assistant that chooses the next safe walk command from GAT, recorded navigation, or random fallback.
_Avoid_: Wander logic, walk selector

**Game Packet**:
A binary message received from or sent to the Ragnarok game connection, including its opcode and payload.
_Avoid_: Network event, WebSocket message

**HUD**:
The overlay mounted over the game for controls, status, settings, and Activity Journal windows.
_Avoid_: Panel, UI popup
