"""Independent numeric/model audit, without reading source answers or generated review JSON."""
from fractions import Fraction as F
from ipaddress import IPv4Interface, IPv4Network, IPv4Address, IPv6Address, collapse_addresses
from itertools import combinations
from math import log2, ceil, isclose
from collections import deque

RESULTS = {}
def check(ids, actual, expected):
    assert actual == expected, (ids, actual, expected)
    for id_ in ids.split(): RESULTS[id_] = str(actual)
def approx(ids, actual, expected, tolerance):
    assert isclose(actual, expected, abs_tol=tolerance), (ids, actual, expected)
    for id_ in ids.split(): RESULTS[id_] = str(actual)
def remainder(bits, generator):
    value, divisor = int(bits, 2), int(generator, 2)
    while value.bit_length() >= divisor.bit_length():
        value ^= divisor << (value.bit_length() - divisor.bit_length())
    return value
def stuff(bits):
    result = ''; ones = 0
    for bit in bits:
        result += bit; ones = ones + 1 if bit == '1' else 0
        if ones == 5: result += '0'; ones = 0
    return result
def fragment(payload, mtu, offset=0):
    size = (mtu - 20) // 8 * 8
    result = []
    while payload > mtu - 20:
        result.append((size, offset // 8)); payload -= size; offset += size
    result.append((payload, offset // 8)); return result
def network(address): return IPv4Interface(address).network
def hosts(address): return network(address).num_addresses - 2
def longest(address, routes):
    return max((r for r in routes if IPv4Address(address) in IPv4Network(r[0], strict=False)), key=lambda r:IPv4Network(r[0],strict=False).prefixlen)[1]
def window_frame(rate, one_way, utilization, ack=0):
    return F(utilization) / (1-F(utilization)) * (2*F(one_way)*rate+ack)
def cwnd_rounds(threshold, rounds):
    cwnd=1
    for _ in range(rounds): cwnd=min(cwnd*2, threshold) if cwnd < threshold else cwnd+1
    return cwnd

check('cn-2-007',2**(4000//1000),16)
check('cn-2-009',64000//2,32000)
check('cn-2-010 cn-2-011 cn-2-012', (2*8000*3,2*4000*4,min(4000*7,2*4000)),(48000,32000,8000))
approx('cn-2-013',3000*log2(1001),29902,1)
check('cn-2-014 cn-2-015 cn-2-016',(400000*3,1200*4,8*4),(1200000,4800,32))
approx('cn-2-017',min(20*log2(10001),200)/min(10*log2(1001),100),2,0.01)
check('cn-2-018 cn-2-019',(2*3000*4,2400//2),(24000,1200))
approx('cn-2-023',0.5*8000*log2(1001),39869,1)
check('cn-2-024 cn-2-026 cn-2-027',(ceil(1001**0.5),2*200000*2,2**(48//8)),(32,800000,64))
check('cn-2-047',10//5,2)
check('cn-2-050',(2*1000+2*20+35,3*500+2*20+35),(2075,1575))
# A serial processing stage longer than link serialization invalidates the source's general pipeline formula.
check('cn-2-051',(3+2-1)*1+(2-1)*3,7)
# Explicit 2-link/3-packet pipeline with serialization1 and processing3 finishes at11, not source formula7.
proc_free=out_free=0
for i in range(3):
    processed=max(i+1,proc_free)+3; proc_free=processed
    out_free=max(processed,out_free)+1
check('cn-2-051',out_free,11)

check('cn-3-007',stuff('0111110001111110'),'011111000011111010')
check('cn-3-010',[s.count('1')%2 for s in ['11000011','11001010','11001100','11010011']],[0,0,0,1])
check('cn-3-011 cn-3-012',(2*2+1,next(r for r in range(1,10) if 2**r>=10+r+1)),(5,4))
check('cn-3-014',remainder('1101011011'+'0000','10011'),int('1110',2))
check('cn-3-015',remainder('101111100','10011'),0)
# An undetected error: XOR any codeword with a nonzero shifted generator.
check('cn-3-015',remainder(format(int('101111100',2)^int('10011',2),'b'),'10011'),0)
check('cn-3-016',min((a^b).bit_count() for a,b in combinations([0x9a,0x5c,0xf0,0x0f],2)),4)
check('cn-3-021',window_frame(4000,F(30,1000),F(4,5)),960)
check('cn-3-022',window_frame(6000,F(1,10),F(2,5)),800)
check('cn-3-025 cn-3-026 cn-3-027 cn-3-028 cn-3-029 cn-3-031',(ceil(log2(7+1)),7-5,ceil(log2(32+1)),2**7-1,2**4,16-7),(3,2,6,127,16,9))
check('cn-3-033',ceil(F(4,5)*F(3)/F(4,5)),3) # strictly >80% requires4
check('cn-3-035',ceil(F(628,64)),10)
check('cn-3-038 cn-3-039',(8-4,2),(4,2))
check('cn-3-040',ceil(F(668,64)),11)
approx('cn-3-041',1000*8000/0.10008,79_936_051,1)
check('cn-3-042',ceil(F(4,5)*F(5625,10000)/F(625,10000)),8)
check('cn-3-043',window_frame(3000,F(1,5),F(2,5)),800)
check('cn-3-044 cn-3-045',(8-5,F(800,2000)),(3,F(2,5)))
check('cn-3-048',stuff('01000111'+'11100011'+'11100000'+'01111110'),'01000111'+'110100011'+'111000000'+'011111010')
check('cn-3-049',remainder('10110011010','11001'),0)
check('cn-3-051',window_frame(5000,F(3,100),F(1,2)),300)
check('cn-3-052',ceil(F(520,20)),26)
check('cn-3-053',(F(20,580),F(140,580),F(80,580)),(F(1,29),F(7,29),F(4,29)))
check('cn-3-054',F(7*8*1000,100000000)/F(112,100000),F(1,2))
a=[1,-1,1,-1]; b=[-1,1,1,-1]; c=[1,1,-1,-1]
check('cn-3-072',[sum(x*y for x,y in zip(u,v)) for u,v in combinations([a,b,c],2)],[0,0,0])
check('cn-3-073',[sum(x*y for x,y in zip([3,-1,1,1],v))//4 for v in [[1,-1,-1,1],[-1,1,-1,1],[1,1,1,1]]],[1,-1,1])
check('cn-3-075',[sum(v)//4 for v in [[2,0,2,0],[0,-2,0,-2],[0,2,0,2]]],[1,-1,1])
check('cn-3-083 cn-3-089 cn-3-092 cn-3-093',(64-22-40,10_000_000*F(2*10000,200_000_000),3*F(512,100),2**10-1),(2,1000,F(1536,100),1023))
check('cn-3-095 cn-3-112 cn-3-116 cn-3-119',(2*F(200,200),F(800,1000)*200/2,(F(512,100)-2*F(1535,1000))*100,F(128*8,100)/2),(2,80,205,F(512,100)))
check('cn-3-122 cn-3-123 cn-3-124',(15*F(512,10),28+F(1998*8,54)+28+2,1023*F(512,10)),(768,354,F(523776,10)))
check('cn-3-156',F(6*8,100),F(48,100))
check('cn-3-161 cn-3-162 cn-3-163',(10_000_000*F(2000,200_000_000),1_000_000_000*F(2000,200_000_000),F(125*8,100_000_000)*200_000_000/2),(100,10000,1000))
approx('cn-3-164',12000/0.0012856,9_334_163,1)

check('cn-4-032 cn-4-096',(100*8,100*8+(100-5*4)-1),(800,879))
check('cn-4-033',longest('132.19.237.5',[('132.0.0.0/8','R1'),('132.19.0.0/11','R2'),('132.19.232.0/22','R3'),('0.0.0.0/0','R4')]),'R2')
check('cn-4-034 cn-4-040 cn-4-055',(hosts('1.1.1.1/24'),hosts('1.1.1.1/20'),hosts('1.1.1.1/22')),(254,4094,1022))
check('cn-4-035',[str(a) for a in map(IPv4Address,['86.33.224.123','86.79.65.126','86.79.65.216','86.68.206.154']) if a in network('86.32.0.0/12')],['86.33.224.123'])
check('cn-4-046',str(network('126.166.66.99/22')),'126.166.64.0/22')
check('cn-4-047',str(network('200.15.10.6/29').broadcast_address),'200.15.10.7')
check('cn-4-048',(str(network('192.168.10.0/20')),IPv4Address('192.16.0.17') in network('192.16.0.19/28')),('192.168.0.0/20',True))
check('cn-4-053',network('74.178.247.96/29').overlaps(network('74.178.247.96/28')),True)
check('cn-4-056',longest('172.18.133.1',[('172.18.128.0/21','A'),('172.18.128.0/22','B'),('172.18.130.0/22','C'),('172.18.132.0/23','D')]),'D') # coverage checked separately
check('cn-4-056',all(network(s).subnet_of(network('172.18.128.0/21')) for s in ['172.18.129.0/24','172.18.130.0/24','172.18.132.0/24','172.18.133.0/24']),True)
check('cn-4-057',[str(n) for n in collapse_addresses([network('192.168.6.192/26'),network('192.168.6.128/26')])],['192.168.6.128/25'])
check('cn-4-059',[str(network('202.3.1.'+str(i)+'/27')) for i in [33,65,44,55]],['202.3.1.32/27','202.3.1.64/27','202.3.1.32/27','202.3.1.32/27'])
check('cn-4-060',str(network('166.66.66.66/18').broadcast_address),'166.66.127.255')
check('cn-4-064',network('211.71.136.23/20')==network('211.71.130.25/20'),True)
check('cn-4-071 cn-4-073 cn-4-081',(2**(29-24),hosts('192.168.5.0/29'),hosts('192.168.4.0/30'),hosts('21.3.0.0/23')),(32,6,2,510))
check('cn-4-075',str(network('180.80.77.55/22').broadcast_address),'180.80.79.255')
check('cn-4-078',longest('169.96.40.5',[(f'169.96.40.0/{p}',f'S{i}') for i,p in enumerate([23,25,27],1)]+[('0.0.0.0/0','S4')]),'S3')
check('cn-4-083',[str(n) for n in collapse_addresses([network(f'35.230.{i}.0/21') for i in [32,40,48,56]])],['35.230.32.0/19'])
check('cn-4-085',2**(32-20-(5-1))-2,254)
check('cn-4-087',fragment(1560,800),[(776,0),(776,97),(8,194)])
check('cn-4-088',str(network('183.80.72.48/18')),'183.80.64.0/18')
check('cn-4-090',[str(a) for a in network('195.123.0.34/30').hosts()],['195.123.0.33','195.123.0.34'])
check('cn-4-091',(str(network('168.16.84.24/20').network_address+1),str(network('168.16.84.24/20').broadcast_address-1)),('168.16.80.1','168.16.95.254'))
check('cn-4-094',fragment(3980,1500),[(1480,0),(1480,185),(1020,370)])
check('cn-4-095',[p for size,off in fragment(2000,1500) for p in fragment(size,576,off*8)],[(552,0),(552,69),(376,138),(520,185)])
check('cn-4-097',[str(n) for n in collapse_addresses([network(f'212.56.{i}.0/24') for i in range(132,136)])],['212.56.132.0/22'])
routes=[('131.128.56.0/24','A'),('131.128.55.32/28','B'),('131.128.55.32/30','C'),('131.128.0.0/16','D')]
check('cn-4-099',[longest(a,routes) for a in ['131.128.55.33','131.128.55.38']],['C','B'])
def hexip(s): return '.'.join(str(int(n,16)) for n in s.split('.'))
routes=[(hexip(a)+'/'+str(p),n) for a,p,n in [('C4.50.0.0',12,'A'),('C4.5E.10.0',20,'B'),('C4.60.0.0',12,'C'),('C4.68.0.0',14,'D'),('80.0.0.0',1,'E'),('40.0.0.0',2,'F'),('00.0.0.0',2,'G')]]
check('cn-4-100',[longest(hexip(a),routes) for a in ['C4.5E.13.87','C4.5E.22.09','C3.41.80.02','5E.43.91.12']],['B','A','E','F'])
check('cn-4-102',[str(network(f'192.168.75.{i}/28').network_address) for i in [18,146,158,161,173]],['192.168.75.16','192.168.75.144','192.168.75.144','192.168.75.160','192.168.75.160'])
check('cn-4-103',(0x5850>>13,(0x5850&0x1fff),(0x5850&0x1fff)*8),(2,6224,49792))
check('cn-4-108',(126-80-1,fragment(1480,800)),(45,[(776,0),(704,97)]))
check('cn-4-110', (F(512,100)-F(151,100)*2)*100,210)
check('cn-4-111',(F(72000,300000),F(4000*8,200000)+F(72000,300000),ceil(F(4,5)*F(540,60)),ceil(log2(8+1))),(F(24,100),F(4,10),8,4))
check('cn-4-115',IPv6Address('8::D0:123:CDEF:89A').exploded,'0008:0000:0000:0000:00d0:0123:cdef:089a')
vecs=[[5,0,8,12,6,2],[16,12,6,0,9,10],[7,6,3,9,0,4]]
dist=[min(row[i]+cost for row,cost in zip(vecs,[6,3,5])) for i in range(6)]; dist[2]=0
check('cn-4-140',dist,[11,6,0,3,5,8])
check('cn-4-141',F((1000+5-1)*1000*8,100_000_000)*1000,F(8032,100))
check('cn-4-145',[min(v+c for v,c in zip(row,[8,10,12,6])) for row in [[1,23,20,22],[12,35,30,28],[24,18,16,36],[36,30,8,24]]],[9,20,28,20])
check('cn-4-148',int(IPv4Address('224.215.145.230')) & 0x7fffff,0x5791e6)
edges=[(11,12),(12,13),(11,14),(14,15),(15,16),(13,15)]
def distances(start):
    d={start:0}; queue=deque([start])
    while queue:
        u=queue.popleft()
        for a,b in edges:
            v=b if a==u else a if b==u else None
            if v is not None and v not in d: d[v]=d[u]+1;queue.append(v)
    return d
check('cn-4-179',[(max(distances(i).values())-1)*30 for i in [14,16]],[30,60])

check('cn-5-021 cn-5-022',(ceil((9192+8)/1480),F(200,200+8+60+18)),(7,F(100,143)))
summed=0xb9b6+0x65c5; summed=(summed&0xffff)+(summed>>16)
check('cn-5-026',(~summed)&0xffff,0xe083)
approx('cn-5-042',2**32/5e9,0.859,0.001)
check('cn-5-048 cn-5-052 cn-5-054 cn-5-055 cn-5-057',(985-211-2,F(60,100),200+1,1666+1+1000,1000-300),(772,F(3,5),201,2667,700))
check('cn-5-058 cn-5-059',(cwnd_rounds(17,4),min(10,cwnd_rounds(8,10))),(16,10))
seq=[1,2,4,8,9,10,11,12,1,2,4,6,7]
check('cn-5-060',seq[12],7)
check('cn-5-061 cn-5-064 cn-5-065 cn-5-066 cn-5-067',(5*10,17+4,min(5,2),4*10,(3*3,16-(1+2+4))),(50,21,2,40,(9,9)))
check('cn-5-068 cn-5-069 cn-5-070 cn-5-072',(200+300+500,cwnd_rounds(8,4),2000-1000,900-400),(1000,9,1000,500))
check('cn-5-074 cn-5-075 cn-5-076',(min(10,cwnd_rounds(4,10)),16-(1+2+4+8),5*5),(10,1,25))
check('cn-5-078 cn-5-079 cn-5-080',(2046+1,(32-8)*2,5001-1000-1),(2047,48,4000))
check('cn-5-082 cn-5-083',(F(12,20),F(12,32),(501+200,501+500-1)),(F(3,5),F(3,8),(701,1000)))
check('cn-5-084 cn-5-085',(3+(16-8),(50+2*800,F(3,2)*50)),(11,(1650,75)))
check('cn-5-087',min(3000,4000)-1000,2000)
check('cn-5-092',(0xf721,0x45,0x2c,0x2c-8),(63265,69,44,36))
check('cn-5-093',fragment(8192+8,1500),[(1480,0),(1480,185),(1480,370),(1480,555),(1480,740),(800,925)])
check('cn-5-096',(10010,10010+1000,10010+2000),(10010,11010,12010))
approx('cn-5-097',64*1024*8/0.02,26.2144e6,1)
approx('cn-5-098',60*1000*8/0.04008,11.976e6,1000)
check('cn-5-099 cn-5-100 cn-5-101',(120-90,150-120,120,4*10,3+8),(30,30,120,40,11))
approx('cn-5-102',2**32/120/1500*1566*8,298.9297e6,100)
check('cn-5-103',128000*F(256,1000)/8,4096)
check('cn-5-105',(0x0d28,0x15,7*4),(3368,21,28))
check('cn-5-107',(20*1024+101,F(20*1024*8,1),F(3,2)*200),(20581,163840,300))
check('cn-6-020 cn-6-052 cn-6-056 cn-6-057 cn-6-058 cn-6-059',((2*10,5*10),1+3,1+100,2+2,1+1,4+3),((20,50),4,101,4,2,7))
check('cn-6-060 cn-6-064 cn-6-065',(4*50+2*800,4*10,2*(1+7)),(1800,40,16))
check('cn-6-071',(100+1,100+1+18000+1,1+1+1,4+1,(1+5)*10,F(18000*8,60)*1000),(101,18102,3,5,60,2400000))
check('cn-6-074',0xc0e6,49382)
check('cn-6-076',(11*2*150+10*35,(1+11)*150+10*35),(3650,2150))
check('cn-6-077',(str(IPv4Address(0x40aa6220)),1+5),('64.170.98.32',6))

CHECKED_IDS=set(RESULTS)
if __name__ == '__main__':
    print(f'verified independent numeric/model checks for {len(CHECKED_IDS)} questions')
