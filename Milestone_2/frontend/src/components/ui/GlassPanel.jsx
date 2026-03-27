import React from "react";
import { motion } from "framer-motion";

export function GlassPanel({ children, title, style = {}, delayed = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delayed }}
      style={{
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: 16,
        padding: 24,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        position: "relative",
        overflow: "hidden",
        ...style
      }}
    >
      {/* Subtle top glare */}
      <div 
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)"
        }}
      />
      
      {title && (
        <h3 style={{ 
          margin: "0 0 16px 0", 
          fontSize: 16, 
          fontWeight: 600, 
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          {title}
        </h3>
      )}
      {children}
    </motion.div>
  );
}
