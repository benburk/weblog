import fileinput
from bisect import bisect_left
from collections.abc import Iterator
from itertools import takewhile


def starts_with(words: list[str], prefix: str) -> Iterator[str]:
    left = bisect_left(words, prefix)
    return takewhile(lambda word: word.startswith(prefix), words[left:])


words = sorted(w.rstrip() for w in fileinput.input())
for first in words:
    for third in starts_with(words, first[6:]):
        for second in starts_with(words, first[3:6]):
            if second.endswith(third[3:6]):
                print(f"{first},{second},{third}")
