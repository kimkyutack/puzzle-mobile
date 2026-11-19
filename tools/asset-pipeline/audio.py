"""Original additive-synthesis score/effects for this project. No sampled recordings.
PCM WAV output is deterministic. The composition and samples are project-authored.
"""
import math, os, struct, wave, random
ROOT='apps/client/public/audio'; os.makedirs(ROOT,exist_ok=True)
RATE=24000
def render(name,notes,length):
    samples=[0.0]*int(length*RATE)
    for start,freq,duration,volume in notes:
        for j in range(int(duration*RATE)):
            idx=int(start*RATE)+j
            if idx>=len(samples): break
            t=j/RATE
            envelope=min(1,t/.012)*math.exp(-t*5/max(duration,.1))
            signal=math.sin(2*math.pi*freq*t)+.23*math.sin(2*math.pi*freq*2*t)+.08*math.sin(2*math.pi*freq*3*t)
            samples[idx]+=signal*envelope*volume
    with wave.open(ROOT+'/'+name+'.wav','wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h',int(max(-.95,min(.95,v))*32767)) for v in samples))
effects={
 'button':[(0,784,.12,.25)],'swap':[(0,440,.1,.2),(.05,660,.13,.16)],
 'invalid':[(0,196,.16,.2),(.08,174.6,.15,.15)],
 'match':[(0,659.25,.22,.23),(.045,987.77,.2,.14)],
 'special':[(0,523.25,.3,.2),(.07,659.25,.3,.2),(.14,783.99,.35,.2),(.22,1046.5,.4,.2)],
 'win':[(0,523.25,.4,.2),(.16,659.25,.4,.2),(.32,783.99,.4,.2),(.5,1046.5,.7,.25)],
 'lose':[(0,440,.4,.18),(.2,392,.4,.15),(.4,329.6,.55,.13)],
 'reward':[(0,1046.5,.25,.2),(.1,1318.5,.4,.17)],
 'restore':[(0,523.25,.5,.2),(.12,783.99,.5,.2),(.24,1046.5,.7,.18)],
 'break':[(0,261.6,.12,.25),(.04,392,.2,.18)]}
for name,notes in effects.items():render(name,notes,max(s+d for s,_,d,_ in notes)+.1)
# A short transient and descending resonant body, rather than a second melody.
# Fixed seeds make all project-authored impact samples reproducible.
def percussion(name, length, frequency, weight, seed):
    rng=random.Random(seed); samples=[]; phase=0.0; low=0.0
    for i in range(int(length*RATE)):
        t=i/RATE; noise=rng.uniform(-1,1); low=low*.72+noise*.28
        phase+=2*math.pi*(frequency*math.exp(-t*22)+70)/RATE
        attack=min(1,t/.0015)
        body=math.sin(phase)*math.exp(-t*26)*weight
        crack=(noise-low)*math.exp(-t*85)*.55+low*math.exp(-t*19)*.24
        chime=math.sin(2*math.pi*1180*t)*math.exp(-t*45)*.1
        samples.append(math.tanh((body+crack+chime)*1.4)*attack*.85)
    with wave.open(ROOT+'/'+name+'.wav','wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h',int(v*32767)) for v in samples))
percussion('match',.16,440,.36,35)
percussion('impact',.25,185,.64,36)
percussion('crack',.22,280,.45,37)
# An original gentle sixteen-bar pentatonic phrase, with a loop-safe rest at its end.
melody=[659.25,783.99,880,783.99,523.25,659.25,587.33,523.25,440,523.25,659.25,587.33,783.99,659.25,523.25,0]
notes=[]
for bar in range(16):
    root=[261.63,220,196,261.63][bar%4]
    for beat,ratio in enumerate([1,1.5,2,1.5]):notes.append((bar*2+beat*.5,root*ratio,.95,.055))
    if melody[bar]:notes.append((bar*2+.1,melody[bar],1.5,.095))
render('garden',notes,34)
print('Generated original score and effects, including 3 percussive contacts.')
