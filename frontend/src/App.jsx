import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import axios from "axios";
import Confetti from "react-confetti";
import "./App.css";

/* ---------- Content / Data (kept from your code) ---------- */
const ecoFacts = [
  "Recycling one ton of plastic saves enough energy to power a home for 2-3 months.",
  "Glass can be recycled endlessly without losing quality.",
  "Paper recycling reduces greenhouse gas emissions by 20-50%.",
  "E-waste contains valuable metals like gold and silver—recycle to recover them."
];

const I18N = {
  en: { title: 'Air Quality Quiz', subtitle: 'Water · Energy · Waste — Calculate Your Eco Score', micro: {
    shower_under5: 'Great — under 5 minutes!', shower_under10: 'Nice — under 10 minutes!', shower_long: 'Consider reducing shower time.',
    devices_low: 'Excellent — low device usage!', devices_medium: 'Moderate device usage.', devices_high: 'High device usage — try to switch off idle devices.',
    ac_low: 'Low AC usage — great!', ac_medium: 'Moderate AC usage — small improvements possible.', ac_high: 'High AC usage — try alternatives or timer.',
    disposable_low: 'Very few disposables — nice!', disposable_many: 'High disposable use — try reusables.'
  }},
  hi: { title: 'हवा गुणवत्ता प्रश्नोत्तरी', subtitle: 'पानी · ऊर्जा · कचरा — अपना इको स्कोर कैलकुलेट करें', micro: {/* ... */} },
  kn: { title: 'ಗಾಳಿ ಗುಣಮಟ್ಟ ಪ್ರಶ್ನಾವಳಿ', subtitle: 'ನೀರು · ಶಕ್ತಿ · ಕಸ — ನಿಮ್ಮ ಇಕೋ ಸ್ಕೋರ್ ಲೆಕ್ಕಾಚಾರ ಮಾಡಿ', micro: {/* ... */} }
};

const TIPS = {
  en: { pro: ["Carry a reusable bottle — avoid many disposables each year.", "Turn off chargers when not in use — they draw power idle.", "Try a 5-minute shower challenge once a week."],
        more: { water: ["Install a low-flow showerhead if possible.", "Turn off the tap while brushing teeth.", "Use a bucket when washing small loads."],
                energy: ["Unplug devices while away.", "Use power strips to switch multiple devices off at once.", "Keep electronics dust-free."],
                waste: ["Carry reusable cutlery and bottles.", "Buy loose produce instead of pre-packaged items.", "Donate old clothes instead of discarding."] } }
  // hi / kn omitted in the snippet for brevity; add if needed
};

/* ---------- Helper Animations ---------- */
const fadeUp = { initial: { y: 18, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { duration: 0.48 } };
const cardPop = { whileHover: { y: -6, boxShadow: "0 10px 30px rgba(2,6,23,0.08)" } };

/* ---------- App Component ---------- */
export default function App() {
  /* --- state (kept & preserved) --- */
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fact, setFact] = useState(ecoFacts[Math.floor(Math.random() * ecoFacts.length)]);
  const [currentPage, setCurrentPage] = useState("home");
  const [quizInputs, setQuizInputs] = useState({
    name: "", shower_min: 10, uses_bucket: false, hours_devices: 6, num_led: 5, ac_hours: 1, disposable_count: 2, uses_reusable: false, recycles: false
  });
  const [quizScores, setQuizScores] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [records, setRecords] = useState(JSON.parse(localStorage.getItem('sustainify_records') || '[]'));
  const [showMoreTips, setShowMoreTips] = useState(false);
  const [flashMessage, setFlashMessage] = useState("");

  useEffect(() => {
    // save records on unmount change
    localStorage.setItem('sustainify_records', JSON.stringify(records));
  }, [records]);

  /* ---------- File upload / AI identify ---------- */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError("");
    }
  };

  const handleIdentify = async () => {
  if (!selectedFile) {
    setError("Please select an image to proceed.");
    flashy("Select an image first.");
    return;
  }

  setLoading(true);
  setError("");
  setResult(null);

  try {
    // Convert file → base64
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64 = reader.result.split(",")[1]; // remove prefix

      try {
        const res = await axios.post(
          "http://localhost:5000/identify", // backend endpoint
          { image: base64 } // send base64 string
        );

        setResult(res.data); // display result
        setFact(ecoFacts[Math.floor(Math.random() * ecoFacts.length)]);
        flashy("Identification complete!");
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || "Identification failed. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(selectedFile);
  } catch (err) {
    console.error(err);
    setError("Failed to process the image.");
    setLoading(false);
  }
};



  /* ---------- Quiz scoring ---------- */
  const computeScores = (inputs) => {
    let water = 30;
    if (inputs.uses_bucket) water += 10;
    if (inputs.shower_min <= 5) water += 20;
    else if (inputs.shower_min <= 10) water += 10;
    else if (inputs.shower_min <= 15) water += 0;
    else water -= 10;
    water = Math.max(0, Math.min(40, water));

    let energy = 20 + Math.min(inputs.num_led * 1.5, 10);
    if (inputs.hours_devices <= 3) energy += 10;
    else if (inputs.hours_devices <= 6) energy += 5;
    else energy -= 5;
    if (inputs.ac_hours <= 2) energy += 5;
    else if (inputs.ac_hours <= 5) energy += 0;
    else energy -= 5;
    energy = Math.max(0, Math.min(40, energy));

    let waste = 10;
    if (inputs.uses_reusable) waste += 5;
    if (inputs.recycles) waste += 5;
    if (inputs.disposable_count <= 1) waste += 5;
    else if (inputs.disposable_count <= 3) waste += 0;
    else waste -= 5;
    waste = Math.max(0, Math.min(20, waste));

    return { water, energy, waste, eco: Math.round(water + energy + waste) };
  };

  const handleQuizCalculate = () => {
    const scores = computeScores(quizInputs);
    setQuizScores(scores);
    const newRecords = [...records, { ts: new Date().toISOString(), name: quizInputs.name || '-', inputs: quizInputs, scores }];
    setRecords(newRecords);
    if (scores.eco >= 100) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    }
    flashy("Score calculated!");
  };

  /* ---------- UI helpers ---------- */
  const flashy = (text) => {
    setFlashMessage(text);
    setTimeout(() => setFlashMessage(""), 3000);
  };

  const renderBadges = () => {
    const badges = [];
    if (quizInputs.shower_min <= 5) badges.push({ title: 'Water Saver', sub: 'Showers under 5 min', icon: '💧' });
    if (quizInputs.hours_devices <= 3 && quizInputs.ac_hours <= 2) badges.push({ title: 'Energy Ninja', sub: 'Devices <=3 hrs & AC <=2 hrs', icon: '⚡' });
    if (quizInputs.uses_reusable && quizInputs.recycles) badges.push({ title: 'Waste Warrior', sub: 'Uses reusable bottle & recycles', icon: '🗑️' });
    return badges.map((b, i) => (
      <motion.div key={i} className="badge-pill" whileHover={{ scale: 1.05 }}>
        <div className="badge-icon">{b.icon}</div>
        <div className="badge-text">
          <div className="badge-label">{b.title}</div>
          <div className="badge-sub">{b.sub}</div>
        </div>
      </motion.div>
    ));
  };

  const exportCSV = () => {
    const csv = [
      'ts,name,shower_min,uses_bucket,hours_devices,num_led,ac_hours,uses_reusable,recycles,disposable_count,eco',
      ...records.map(r => `${r.ts},${r.name},${r.inputs.shower_min},${r.inputs.uses_bucket},${r.inputs.hours_devices},${r.inputs.num_led},${r.inputs.ac_hours},${r.inputs.uses_reusable},${r.inputs.recycles},${r.inputs.disposable_count},${r.scores.eco}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sustainify_records.csv'; a.click();
    URL.revokeObjectURL(url);
    flashy("CSV exported");
  };

  /* ---------- Small UI blocks (hero, features) ---------- */
  const Hero = (
    <section className="hero">
      <div className="hero-inner">
        <motion.h1 {...fadeUp} className="hero-title">Air — Clean design for modern sustainability</motion.h1>
        <motion.p {...fadeUp} className="hero-sub">Upload an item & get AI-driven recycling guidance. Fast, readable, beautiful.</motion.p>
        <motion.div {...fadeUp} className="hero-ctas">
          <button className="btn primary" onClick={() => setCurrentPage("services")}>Get started</button>
          <button className="btn ghost" onClick={() => setCurrentPage("quiz")}>Take the quiz</button>
        </motion.div>
        <motion.div {...fadeUp} className="hero-trust">Trusted by small teams & students — <strong>fast</strong> & <strong>transparent</strong></motion.div>
      </div>

      <motion.div className="hero-visual" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .6 }}>
        <div className="mock-card">
          <div className="mock-top">Air analytics</div>
          <div className="mock-body">Interactive preview / screenshot</div>
          <div className="mock-footer">— mock data —</div>
        </div>
      </motion.div>
    </section>
  );

  /* ---------- Main render ---------- */
  return (
    <div className="app-shell">
      {showConfetti && <Confetti />}
      <AnimatePresence>{flashMessage && (
        <motion.div className="toast" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{flashMessage}</motion.div>
      )}</AnimatePresence>

      {/* Header */}
      <header className="site-header">
        <div className="container header-inner">
          <motion.div className="brand" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="brand-mark">Air</div>
            <div className="brand-name">Sustainify</div>
          </motion.div>

          <nav className="main-nav">
            <button className={currentPage === "home" ? "nav-active" : ""} onClick={() => setCurrentPage("home")}>Home</button>
            <button className={currentPage === "services" ? "nav-active" : ""} onClick={() => setCurrentPage("services")}>Analyze</button>
            <button className={currentPage === "quiz" ? "nav-active" : ""} onClick={() => setCurrentPage("quiz")}>Quiz</button>
            <button className={currentPage === "testimonials" ? "nav-active" : ""} onClick={() => setCurrentPage("testimonials")}>Stories</button>
            <button onClick={() => setCurrentPage("contact")}>Contact</button>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main>
        {/* Home */}
        {currentPage === "home" && (
          <div className="page container">{Hero}</div>
        )}

        {/* Services — AI Upload */}
        {currentPage === "services" && (
          <section className="section container">
            <motion.h2 {...fadeUp}>Upload & Analyze</motion.h2>
            <motion.p {...fadeUp} className="muted">Quickly identify recyclables using your camera or gallery.</motion.p>

            <div className="grid two">
              <motion.div className="card upload-card" {...cardPop} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h3>🔍 Identify an item</h3>
                <label className="file-input">
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                  <span>{selectedFile ? selectedFile.name : "Choose or drag an image"}</span>
                </label>

                {previewUrl && <div className="preview-wrap"><img src={previewUrl} alt="preview" /></div>}

                <button className="btn primary" onClick={handleIdentify} disabled={loading}>
                  {loading ? "Analyzing..." : "Identify item"}
                </button>

                {error && <div className="error">{error}</div>}
                {result && (
                  <div className="result">
                    <h4>{result.name || "Result"}</h4>
                    <p className="muted">{result.description || JSON.stringify(result)}</p>
                    <div className="fact">{fact}</div>
                  </div>
                )}
              </motion.div>

              <motion.div className="card info-card" {...cardPop} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h3>How it works</h3>
                <ol className="steps">
                  <li>Upload an image of the item.</li>
                  <li>We run AI classification and provide recyclable guidance.</li>
                  <li>Get disposal / recycling tips and alternatives.</li>
                </ol>

                <div className="tips">
                  <h4>Quick tips</h4>
                  <ul>
                    <li>Remove labels — helps classification.</li>
                    <li>Good lighting improves accuracy.</li>
                    <li>Try multiple angles for small objects.</li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Quiz */}
        {currentPage === "quiz" && (
          <section className="section container">
            <motion.h2 {...fadeUp}>Sustainify — Quick Quiz</motion.h2>
            <motion.p {...fadeUp} className="muted">Answer a few quick questions and get your eco score.</motion.p>

            <div className="grid two">
              <motion.div className="card" {...cardPop}>
                <label className="field"><div className="label">Name</div>
                  <input value={quizInputs.name} onChange={e => setQuizInputs({...quizInputs, name: e.target.value})} placeholder="Your name" />
                </label>

                <label className="field">
                  <div className="label">Shower time (minutes)</div>
                  <input type="range" min="1" max="30" value={quizInputs.shower_min} onChange={e => setQuizInputs({...quizInputs, shower_min: Number(e.target.value)})} />
                  <div className="range-value">{quizInputs.shower_min} min</div>
                </label>

                <label className="field inline">
                  <input type="checkbox" checked={quizInputs.uses_bucket} onChange={e => setQuizInputs({...quizInputs, uses_bucket: e.target.checked})} />
                  <div className="label">Use bucket for small wash</div>
                </label>

                <label className="field">
                  <div className="label">Hours devices active / day</div>
                  <input type="number" min="0" max="24" value={quizInputs.hours_devices} onChange={e => setQuizInputs({...quizInputs, hours_devices: Number(e.target.value)})} />
                </label>

                <label className="field">
                  <div className="label">Number of LED bulbs</div>
                  <input type="number" min="0" max="20" value={quizInputs.num_led} onChange={e => setQuizInputs({...quizInputs, num_led: Number(e.target.value)})} />
                </label>

                <label className="field inline">
                  <input type="checkbox" checked={quizInputs.uses_reusable} onChange={e => setQuizInputs({...quizInputs, uses_reusable: e.target.checked})} />
                  <div className="label">Use reusable bottle</div>
                </label>

                <label className="field inline">
                  <input type="checkbox" checked={quizInputs.recycles} onChange={e => setQuizInputs({...quizInputs, recycles: e.target.checked})} />
                  <div className="label">I recycle regularly</div>
                </label>

                <div className="row-between">
                  <button className="btn ghost" onClick={() => { setQuizInputs({ name: "", shower_min: 10, uses_bucket: false, hours_devices: 6, num_led: 5, ac_hours:1, disposable_count:2, uses_reusable:false, recycles:false }); setQuizScores(null); }}>Reset</button>
                  <button className="btn primary" onClick={handleQuizCalculate}>Calculate</button>
                </div>
              </motion.div>

              <motion.div className="card" {...cardPop}>
                <h4>Your Scores</h4>
                {!quizScores ? (
                  <div className="muted">No score yet — calculate to see your eco rating.</div>
                ) : (
                  <div className="scores">
                    <div className="score-chips">
                      <div className="chip">Water <strong>{quizScores.water}</strong></div>
                      <div className="chip">Energy <strong>{quizScores.energy}</strong></div>
                      <div className="chip">Waste <strong>{quizScores.waste}</strong></div>
                    </div>

                    <div className="meter">
                      <CircularProgressbar
                        value={Math.min(100, quizScores.eco)}
                        text={`${quizScores.eco}`}
                        styles={buildStyles({ textSize: '16px', pathTransitionDuration: 0.6 })}
                      />
                    </div>

                    <div className="badges">{renderBadges()}</div>

                    <div className="mt-4 row-between">
                      <button className="btn ghost" onClick={() => exportCSV()}>Export CSV</button>
                      <button className="btn" onClick={() => setShowMoreTips(s => !s)}>{showMoreTips ? "Hide tips" : "Show tips"}</button>
                    </div>

                    {showMoreTips && (
                      <div className="tips-grid">
                        <div>
                          <h5>Water tips</h5>
                          <ul>{TIPS.en.more.water.map((t,i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                        <div>
                          <h5>Energy tips</h5>
                          <ul>{TIPS.en.more.energy.map((t,i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                        <div>
                          <h5>Waste tips</h5>
                          <ul>{TIPS.en.more.waste.map((t,i) => <li key={i}>{t}</li>)}</ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </section>
        )}

        {/* Testimonials / Stories */}
        {currentPage === "testimonials" && (
          <section className="section container">
            <motion.h2 {...fadeUp}>What people say</motion.h2>
            <motion.div className="grid three">
              <motion.div className="card" {...cardPop}><p>"This app helped me reduce waste!" — Priya</p></motion.div>
              <motion.div className="card" {...cardPop}><p>"The AI identify is shockingly good." — Aman</p></motion.div>
              <motion.div className="card" {...cardPop}><p>"Simple, clean UI — I love it." — Sara</p></motion.div>
            </motion.div>
          </section>
        )}

        {/* Contact */}
        {currentPage === "contact" && (
          <section className="section container">
            <motion.h2 {...fadeUp}>Contact & support</motion.h2>
            <div className="grid two">
              <motion.div className="card" {...cardPop}>
                <p className="muted">Questions about migration, custom work or API?</p>
                <form onSubmit={(e)=>{ e.preventDefault(); flashy("Message sent — thanks!"); }}>
                  <label className="field"><div className="label">Name</div><input placeholder="Your name" /></label>
                  <label className="field"><div className="label">Email</div><input placeholder="you@domain.com" /></label>
                  <label className="field"><div className="label">Message</div><textarea rows={5} placeholder="How can we help?" /></label>
                  <div className="row-between">
                    <button className="btn ghost" type="reset">Reset</button>
                    <button className="btn primary" type="submit">Send message</button>
                  </div>
                </form>
              </motion.div>

              <motion.div className="card" {...cardPop}>
                <h4>Quick links</h4>
                <ul className="muted">
                  <li>Docs</li>
                  <li>Pricing</li>
                  <li>Enterprise</li>
                </ul>
                <div className="mt-6">
                  <strong>Fact</strong>
                  <p className="muted">{fact}</p>
                </div>
              </motion.div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>© {new Date().getFullYear()} Sustainify — Built with ♻️</div>
          <div className="muted">Privacy · Terms</div>
        </div>
      </footer>
    </div>
  );
}
