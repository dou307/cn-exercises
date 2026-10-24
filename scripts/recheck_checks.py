"""Independent calculations for the second-pass decisions (no answer data read)."""
from collections import deque
from fractions import Fraction


def remainder(bits, generator):
    n, g = int(bits, 2), int(generator, 2)
    while n.bit_length() >= g.bit_length():
        n ^= g << (n.bit_length() - g.bit_length())
    return n


assert [remainder('10111' + tail, '10011') for tail in ('0000', '0100', '1000', '1100')] == [12, 8, 4, 0]
# A nonzero undetected error pattern: XOR a shifted generator into a valid codeword.
received = int('101111100', 2)
sent = received ^ (int('10011', 2) << 2)
assert sent != received and remainder(bin(sent)[2:], '10011') == 0
assert remainder('10110011010', '11001') == 0
assert '10110011010'[:-4] == '1011001' and '10110011010'[-4:] == '1010'

h = bytes.fromhex('45 00 00 54 00 03 58 50 20 06 FF F0 7C 4E 03 02 B4 0E 0F 02')
field = int.from_bytes(h[6:8], 'big')
assert (h[0] & 15) * 4 == 20 and int.from_bytes(h[2:4], 'big') - 20 == 64
assert bool(field & 0x4000) and not field & 0x2000
assert field & 8191 == 6224 and (field & 8191) * 8 == 49792
s = sum(int.from_bytes(h[i:i+2], 'big') for i in range(0, 20, 2))
while s >> 16:
    s = (s & 65535) + (s >> 16)
assert s == 65535

edges = [(11,12), (12,13), (11,14), (14,15), (15,16), (13,15)]
def distances(start):
    d, queue = {start:0}, deque([start])
    while queue:
        u = queue.popleft()
        for a,b in edges:
            v = b if a == u else a if b == u else None
            if v is not None and v not in d:
                d[v] = d[u] + 1
                queue.append(v)
    return d

assert max(distances(14).values()) == 2
assert max(distances(16).values()) == 3
assert [(max(distances(n).values()) - 1) * 30 for n in (14,16)] == [30,60]
assert min((distances(14)[r],r) for r in (11,13))[1] == 11
assert min((distances(15)[r],r) for r in (11,13))[1] == 13

assert Fraction(128000) * Fraction(256,1000) / 8 == 4096
assert Fraction(8192*8,1) / (Fraction(8192*8,256000) + Fraction(256,1000)) == 128000
assert Fraction(60) + 2*Fraction(10,1000) == Fraction(6002,100)
assert int('01ef',16) == 495 < 1500
print('second-pass CRC counterexample, IPv4 fields/checksum, RIP propagation, and TCP timing/window checks passed')
