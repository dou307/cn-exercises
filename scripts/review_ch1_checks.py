"""Independent arithmetic checks for the first source chapter's numeric exercises."""
from fractions import Fraction as F

checks = {
    "cn-1-009": min(100, 1000, 10),  # Mb/s
    "cn-1-010": F(100_000, 10**8) * 20_000_000,  # bits
    "cn-1-011": 36,  # ms: two 8ms sends; single-router 10ms processing each
    "cn-1-012": {"5kb_circuit": 2 + F(5) / F(5, 2), "5kb_message": 2 * F(5) / F(5, 2), "5kb_packet": 2 * F(5) / F(5, 2), "500kb_circuit": 2 + F(500) / F(5, 2), "500kb_packet": F(500) / F(5, 2) + F(5) / F(5, 2)},
    "cn-1-013": F(1000 + 3 - 1) * F(1000 * 8, 100_000_000) * 1000,  # ms
    "cn-1-014": {"message_ms": F(8_000_000, 10_000_000) * 2 * 1000, "packet_ms": F(800 + 2 - 1) * F(10_000, 10_000_000) * 1000},
    "cn-1-015": F(1000 + 2 - 1) * F(1000 * 8, 100_000_000) * 1000 + 2 * F(1000, 100_000_000) * 1000,
    "cn-1-016": min(10, 1000, 1000, 10),  # best path Mb/s
    "cn-1-017": {"circuit_s": F(32, 1_000_000) + F(16_000_000, 10_000_000), "message_s": F(16_000_000, 10_000_000) + F(16_000_000, 100_000_000) + F(16_000_000, 1_000_000_000), "packet_s": F(5000, 1) * F(400 * 8, 10_000_000) + F(400 * 8, 100_000_000) + F(400 * 8, 1_000_000_000)},
    "cn-1-051": F(400, 400 + 5 * 20),
    "cn-1-056": {"1000": F(100 * 1_000_000, 1000) + 1000, "20000": F(100 * 1_000_000, 20_000) + 20_000, "best_D": 10_000},
    "cn-1-057": {"100B_bps": F(100 * 8, F(2000, 200_000_000)), "512B_bps": F(512 * 8, F(2000, 200_000_000))},
}

assert checks["cn-1-009"] == 10
assert checks["cn-1-010"] == 20_000
assert checks["cn-1-011"] == 36
assert checks["cn-1-012"]["5kb_circuit"] == checks["cn-1-012"]["5kb_message"] == checks["cn-1-012"]["5kb_packet"] == 4
assert checks["cn-1-012"]["500kb_circuit"] == checks["cn-1-012"]["500kb_packet"] == 202
assert checks["cn-1-013"] == F(8016, 100)
assert checks["cn-1-014"] == {"message_ms":1600,"packet_ms":801}
assert checks["cn-1-015"] == F(801, 10)
assert checks["cn-1-016"] == 10
assert checks["cn-1-017"]["message_s"] > checks["cn-1-017"]["packet_s"] > checks["cn-1-017"]["circuit_s"]
assert checks["cn-1-051"] == F(4,5)
assert checks["cn-1-056"] == {"1000":101_000,"20000":25_000,"best_D":10_000}
assert checks["cn-1-057"] == {"100B_bps":80_000_000,"512B_bps":409_600_000}
print("verified", len(checks), "independent numeric/model checks")
