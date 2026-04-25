/**
 * Root-stack route names + param shapes. Colocated in its own module
 * (not inside `RootNavigator.tsx`) so screens can import only the type
 * without dragging the navigator component tree into their bundle.
 */

export type MatchResultOutcome = 'victory' | 'defeat' | 'draw' | 'stalemate';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Matchmaking: { modeId: number };
  SecretSetup: { modeId: number; opponentId: string };
  Match: { modeId: number; opponentId: string };
  MatchResult: { modeId: number; outcome: MatchResultOutcome };
  Shop: undefined;
  AdWatch: undefined;
  Profile: undefined;
  InsufficientTokens: { modeId: number };
  ChangeUsername: undefined;
};
