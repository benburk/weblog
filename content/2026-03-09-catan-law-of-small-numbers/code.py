"""Colonist.io Balanced Dice — minimal implementation using sum counts only."""

import random
from collections import deque, Counter

# initial card counts for sums 2..12: [1,2,3,4,5,6,5,4,3,2,1]
INITIAL_COUNTS = [min(s - 1, 13 - s) for s in range(2, 13)]

RESHUFFLE_AT = 13
RECENCY_WINDOW = 5
RECENCY_PENALTY = 0.34
STREAK_FACTOR = 0.4


class BalancedDice:
    def __init__(self):
        self.counts = list(INITIAL_COUNTS)  # counts[0]=sum2, counts[10]=sum12
        self.cards_left = 36
        self.recent = deque(maxlen=RECENCY_WINDOW)
        self.sevens = [0, 0]  # total 7s per player (index 0/1)
        self.streak_player = -1
        self.streak_count = 0

    def reshuffle(self) -> None:
        self.counts = list(INITIAL_COUNTS)
        self.cards_left = 36

    def weights(self, player: int) -> list[float]:
        """Return probability weights for sums 2..12 (length 11)."""
        w = [c / self.cards_left for c in self.counts]

        # recency penalty
        rc = Counter(self.recent)
        for s, n in rc.items():
            w[s - 2] *= max(0, 1 - RECENCY_PENALTY * n)

        # 7 balancing
        total_7 = sum(self.sevens)
        i7 = 5  # index of sum 7
        # streak
        streak_adj = 0
        if self.streak_count > 0:
            sign = -1 if self.streak_player == player else 1
            streak_adj = STREAK_FACTOR * self.streak_count * sign
        # imbalance
        imb = 1
        if total_7 >= 2:
            imb = 1 + (0.5 - self.sevens[player] / total_7) / 0.5
        w[i7] *= max(0, min(2, imb + streak_adj))

        return w

    def roll(self, player: int) -> int:
        if self.cards_left < RESHUFFLE_AT:
            self.reshuffle()

        w = self.weights(player)

        s = random.choices(range(2, 13), weights=w)[0]

        # update state
        self.counts[s - 2] -= 1
        self.cards_left -= 1
        self.recent.append(s)
        if s == 7:
            self.sevens[player] += 1
            if self.streak_player != player:
                self.streak_player = player
                self.streak_count = 0
            self.streak_count += 1

        return s


if __name__ == "__main__":
    random.seed(42)
    games, rolls_per = 10000, 60
    total = Counter()
    for _ in range(games):
        d = BalancedDice()
        for i in range(rolls_per):
            total[d.roll(i % 2)] += 1

    n = games * rolls_per
    print("Sum   Pct     Expected")
    for s in range(2, 13):
        exp = INITIAL_COUNTS[s - 2] / 36
        print(f" {s:2d}   {total[s] / n:5.2%}    {exp:5.2%}")
