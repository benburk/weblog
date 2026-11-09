"""Compare naive vs informed dice predictors using log score and KL divergence."""

import numpy as np
from code import BalancedDice, INITIAL_COUNTS, RESHUFFLE_AT

NAIVE = np.array([c / 36 for c in INITIAL_COUNTS])


def simulate(n_games=10_000, n_rolls=70):
    naive_score, informed_score = 0.0, 0.0
    kl_divs = []

    for _ in range(n_games):
        dice = BalancedDice()
        for i in range(n_rolls):
            player = i % 2
            if dice.cards_left < RESHUFFLE_AT:
                dice.reshuffle()
            w = np.array(dice.weights(player))
            q = w / w.sum()

            roll = dice.roll(player)
            k = roll - 2

            naive_score += np.log2(NAIVE[k])
            informed_score += np.log2(q[k])
            mask = q > 0
        kl_divs.append(np.sum(q[mask] * np.log2(q[mask] / NAIVE[mask])))

    n = n_games * n_rolls
    print(f"naive:    {naive_score/n:.4f} bits/roll")
    print(f"informed: {informed_score/n:.4f} bits/roll")
    print(f"edge:     {(informed_score - naive_score)/n:.4f} bits/roll")
    print(f"avg KL:   {np.mean(kl_divs):.4f} bits/roll")


if __name__ == "__main__":
    simulate()
