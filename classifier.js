/**
 * classifier.js — TF.js neural network for gesture classification
 * Input: 63-dim feature vector (21 landmarks × 3)
 * Output: softmax over 6 classes
 */
const NUM_CLASSES = 6, INPUT_DIM = 63;

export class GestureClassifier {
  constructor() { this._model = null; this._built = false; }

  async build() {
    if (!window.tf) { console.warn('[Classifier] TF.js not loaded'); return; }
    const tf = window.tf;

    this._model = tf.sequential({ layers: [
      tf.layers.dense({ inputShape: [INPUT_DIM], units: 128, activation: 'relu', kernelInitializer: 'glorotUniform' }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: NUM_CLASSES, activation: 'softmax' }),
    ]});

    this._model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    await this._preTrain();
    this._built = true;
    console.log('[Classifier] Model ready');
  }

  _syntheticSamples(classId, n = 80) {
    const samples = [];
    for (let s = 0; s < n; s++) {
      const lm = new Float32Array(INPUT_DIM);
      for (let i = 0; i < 21; i++) {
        lm[i*3]   = (Math.random()-0.5)*0.4;
        lm[i*3+1] = (Math.random()-0.5)*0.4;
        lm[i*3+2] = (Math.random()-0.5)*0.1;
      }
      switch (classId) {
        case 1: for (let i=4;i<21;i+=4) { lm[i*3+1] += 0.3+Math.random()*0.1; } break;
        case 2: for (let i=4;i<21;i+=4) { lm[i*3+1] -= 0.2+Math.random()*0.05; } break;
        case 3: lm[4*3]=0.02; lm[4*3+1]=0.02; lm[8*3]=0.02; lm[8*3+1]=0.02; break;
        case 4: {
          const ang = 1.2+Math.random()*0.3;
          for (let i=0;i<21;i++) {
            const ox=lm[i*3],oy=lm[i*3+1];
            lm[i*3]=ox*Math.cos(ang)-oy*Math.sin(ang);
            lm[i*3+1]=ox*Math.sin(ang)+oy*Math.cos(ang);
          }
          break;
        }
        case 5: for (let i=1;i<21;i++) { lm[i*3+2]+=0.2+Math.random()*0.1; } break;
      }
      let minV=Infinity, maxV=-Infinity;
      for (const v of lm) { if(v<minV) minV=v; if(v>maxV) maxV=v; }
      const range = maxV-minV||1;
      for (let i=0;i<lm.length;i++) lm[i]=(lm[i]-minV)/range*2-1;
      samples.push(lm);
    }
    return samples;
  }

  async _preTrain() {
    const tf = window.tf;
    const allX=[], allY=[];
    for (let c=0;c<NUM_CLASSES;c++) {
      for (const s of this._syntheticSamples(c,120)) {
        allX.push(Array.from(s));
        const label=new Array(NUM_CLASSES).fill(0); label[c]=1;
        allY.push(label);
      }
    }
    // Shuffle
    for (let i=allX.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [allX[i],allX[j]]=[allX[j],allX[i]];
      [allY[i],allY[j]]=[allY[j],allY[i]];
    }
    const xs=tf.tensor2d(allX), ys=tf.tensor2d(allY);
    await this._model.fit(xs,ys,{epochs:40,batchSize:32,shuffle:true,verbose:0});
    xs.dispose(); ys.dispose();
  }

  predict(landmarks) {
    if (!this._built||!this._model||!landmarks||landmarks.length<21)
      return {classId:0,confidence:1.0,probabilities:[1,0,0,0,0,0]};
    const tf = window.tf;
    const features = this._extractFeatures(landmarks);
    const inp = tf.tensor2d([features]);
    const out = this._model.predict(inp);
    const probs = out.dataSync();
    inp.dispose(); out.dispose();
    let maxP=0, classId=0;
    for (let i=0;i<probs.length;i++) { if(probs[i]>maxP){maxP=probs[i];classId=i;} }
    return {classId,confidence:maxP,probabilities:Array.from(probs)};
  }

  _extractFeatures(landmarks) {
    const wrist=landmarks[0], features=[];
    for (const lm of landmarks) {
      features.push(lm.x-wrist.x, lm.y-wrist.y, lm.z-wrist.z);
    }
    let maxAbs=0;
    for (const v of features) { if(Math.abs(v)>maxAbs) maxAbs=Math.abs(v); }
    if(maxAbs===0) maxAbs=1;
    return features.map(v=>v/maxAbs);
  }

  async learn(landmarks, classId) {
    if (!this._built) return;
    const tf = window.tf;
    const features=this._extractFeatures(landmarks);
    const label=new Array(NUM_CLASSES).fill(0); label[classId]=1;
    const xs=tf.tensor2d([features]), ys=tf.tensor2d([label]);
    await this._model.fit(xs,ys,{epochs:5,verbose:0});
    xs.dispose(); ys.dispose();
  }
}

export const GESTURE_LABELS = [
  'Idle',
  'Open Hand',
  'Fist',
  'Pinch',
  'Rotate',
  'Zoom'
];

let _classifier = null;

export async function initClassifier(callback) {
  if (!window.tf) {
    console.warn('[Classifier] TF.js not loaded from CDN, waiting...');
    await new Promise(r => setTimeout(r, 1000));
    if (!window.tf) {
      console.error('[Classifier] TF.js still not loaded!');
      return false;
    }
  }
  callback?.('[Classifier] Building model...');
  _classifier = new GestureClassifier();
  await _classifier.build();
  callback?.('[Classifier] Ready.');
  return true;
}

export async function predict(landmarks) {
  if (!_classifier) {
    return { classIndex: 0, confidence: 0, label: 'Idle' };
  }
  const result = _classifier.predict(landmarks);
  return {
    classIndex: result.classId,
    confidence: result.confidence,
    label: GESTURE_LABELS[result.classId],
    probabilities: result.probabilities
  };
}