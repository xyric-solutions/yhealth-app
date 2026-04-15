"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, Linkedin, Mail, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const leadership = [
  {
    name: "Alex Chen",
    role: "CEO & Co-Founder",
    bio: "Former health tech executive with 15+ years of experience building scalable platforms. Passionate about making healthcare accessible through technology.",
    initials: "AC",
    gradient: "from-cyan-400 to-cyan-600",
  },
  {
    name: "Sarah Martinez",
    role: "CTO & Co-Founder",
    bio: "AI researcher and engineer specializing in machine learning for healthcare. Led AI initiatives at leading tech companies before co-founding Balencia.",
    initials: "SM",
    gradient: "from-purple-400 to-purple-600",
  },
  {
    name: "Dr. James Wilson",
    role: "Chief Medical Officer",
    bio: "Board-certified physician with expertise in preventive medicine and digital health. Ensures all recommendations are evidence-based and medically sound.",
    initials: "JW",
    gradient: "from-pink-400 to-pink-600",
  },
  {
    name: "Emily Rodriguez",
    role: "Head of Product",
    bio: "Product leader with a track record of building user-centric health applications. Focuses on creating intuitive experiences that drive real health outcomes.",
    initials: "ER",
    gradient: "from-emerald-400 to-emerald-600",
  },
];

export function LeadershipSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-8xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Users className="w-4 h-4 text-primary" />
              <span>Leadership</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Meet the Team
              <span className="block gradient-text-animated">Behind Balencia</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our leadership team brings together decades of experience in technology, healthcare,
              and product design, united by a shared vision of transforming personal health.
            </p>
          </motion.div>

          {/* Leadership Philosophy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-16 text-center max-w-3xl mx-auto"
          >
            <div className="glass-card rounded-2xl p-8 lg:p-10">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
              <p className="text-lg text-foreground leading-relaxed">
                We believe that great leadership is about empowering others, fostering innovation,
                and maintaining an unwavering commitment to our mission. Our team combines deep
                technical expertise with genuine care for the people we serve, creating a culture
                where excellence and empathy go hand in hand.
              </p>
            </div>
          </motion.div>

          {/* Team Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {leadership.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="glass-card rounded-2xl p-6 lg:p-8 text-center relative overflow-hidden group hover:border-primary/30 transition-all duration-300"
              >
                {/* Gradient Background on Hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${member.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
                />

                {/* Avatar */}
                <div className="mb-6 flex justify-center">
                  <Avatar className="w-24 h-24 border-2 border-primary/20">
                    <AvatarImage src="" alt={member.name} />
                    <AvatarFallback
                      className={`bg-gradient-to-br ${member.gradient} text-white text-2xl font-bold`}
                    >
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-1">{member.name}</h3>
                <p className="text-sm text-primary mb-4 font-medium">{member.role}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>

                {/* Social Links (Placeholder) */}
                <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-white/10">
                  <button
                    className="w-8 h-8 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`LinkedIn profile for ${member.name}`}
                  >
                    <Linkedin className="w-4 h-4" />
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`Email ${member.name}`}
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>

                {/* Decorative Element */}
                <div
                  className={`absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-br ${member.gradient} opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

