import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BrainCircuit, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export default function LoadingOverlay({ isLoading,platform = "tiktok"}) {
  const [currentStep, setCurrentStep] = useState(1);

  const STEPS = [
    {
      id: 1,
      label: "Fetching Data",
      subLabel: `กำลังดึงข้อมูลจาก ${platform === "youtube" ? "YouTube" : "TikTok"}...`,
      icon: Search,
    },
    {
      id: 2,
      label: "AI Analyzing",
      subLabel: "Gemini กำลังวิเคราะห์ความ 'ถูกจริต'...",
      icon: BrainCircuit,
    },
    {
      id: 3,
      label: "Finalizing",
      subLabel: "สรุปผลและจับคู่...",
      icon: Sparkles,
    },
  ];

  useEffect(() => {
    if (isLoading) {
      setCurrentStep(1);
      const timer1 = setTimeout(() => setCurrentStep(2), 3000);
      const timer2 = setTimeout(() => setCurrentStep(3), 5500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // 👇 ใช้ Style โดยตรง เพื่อบังคับให้เป็น Pop-up แน่นอน
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)", // สีพื้นหลังดำจางๆ
            backdropFilter: "blur(5px)", // เบลอพื้นหลัง
          }}
        >
          {/* 👇 ตัวการ์ด Pop-up */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              transition: { type: "spring", stiffness: 300, damping: 25 } 
            }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "400px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              fontFamily: "'Prompt', sans-serif", // ถ้ามีฟอนต์ไทยใส่ตรงนี้
            }}
          >
            {/* Decoration Header (เส้นสีด้านบน) */}
            <div style={{ height: "8px", width: "100%", background: "linear-gradient(to right, #ef4444, #ec4899)" }} />

            <div style={{ padding: "32px" }}>
              {/* Header Section */}
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <div style={{ 
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "48px", height: "48px", marginBottom: "16px",
                  borderRadius: "50%", backgroundColor: "#fef2f2", color: "#ef4444"
                }}>
                  <Loader2 className="animate-spin" size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#111827", margin: 0 }}>
                  กำลังประมวลผล
                </h2>
                <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
                  AI กำลังคัดกรองคนที่ "ถูกจริต" ให้คุณ
                </p>
              </div>

              {/* Steps Container */}
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Connecting Line (เส้นเทาพื้นหลัง) */}
                <div style={{ position: "absolute", left: "19px", top: "10px", bottom: "20px", width: "2px", backgroundColor: "#f3f4f6", zIndex: 0 }} />
                
                {/* Active Line (เส้นสีแดงวิ่ง) */}
                <motion.div 
                  style={{ position: "absolute", left: "19px", top: "10px", width: "2px", backgroundColor: "#ef4444", zIndex: 0 }} 
                  initial={{ height: "0%" }}
                  animate={{ height: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />

                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  const Icon = isCompleted ? CheckCircle2 : step.icon;

                  // Dynamic Styles
                  const circleStyle = isActive 
                    ? { borderColor: "#ef4444", backgroundColor: "#ffffff", color: "#ef4444", transform: "scale(1.1)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }
                    : isCompleted 
                      ? { borderColor: "#ef4444", backgroundColor: "#ef4444", color: "#ffffff" }
                      : { borderColor: "#f3f4f6", backgroundColor: "#f9fafb", color: "#d1d5db" };

                  return (
                    <div key={step.id} style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "flex-start", gap: "16px" }}>
                      {/* Icon Circle */}
                      <motion.div
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "40px", height: "40px", borderRadius: "50%", border: "2px solid",
                          transition: "all 0.3s ease",
                          ...circleStyle
                        }}
                      >
                        <Icon size={18} strokeWidth={2.5} />
                      </motion.div>

                      {/* Text */}
                      <div style={{ flex: 1, paddingTop: "6px" }}>
                        <h3 style={{ 
                          fontSize: "14px", fontWeight: "600", margin: 0, transition: "color 0.3s",
                          color: isActive || isCompleted ? "#1f2937" : "#d1d5db"
                        }}>
                          {step.label}
                        </h3>
                        {isActive && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            style={{ fontSize: "12px", color: "#ef4444", fontWeight: "500", marginTop: "2px", margin: 0 }}
                          >
                            {step.subLabel}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Progress Bar */}
            <div style={{ height: "6px", width: "100%", backgroundColor: "#f3f4f6" }}>
                <motion.div 
                  style={{ height: "100%", background: "linear-gradient(to right, #ef4444, #ec4899)" }}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 8, ease: "linear" }}
                />
            </div>

          </motion.div>
          {/* CSS Animation for Spinner */}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
