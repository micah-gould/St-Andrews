import React from "react";
import { ArrowRight } from "lucide-react";

type Subject = { id: string; name: string };

type SubjectSelectionSectionProps = {
  subjects: Subject[];
  onSelectSubject: (subjectId: string) => void;
};

export function SubjectSelectionSection({
  subjects,
  onSelectSubject,
}: SubjectSelectionSectionProps) {
  return (
    <section id="subject-selection" aria-label="Subject selection">
      <div className="subject-selection-content">
        <p className="subject-selection-kicker">University of St Andrews</p>
        <h2>Build Your St Andrews Degree Path</h2>
        <p className="subject-selection-intro">
          Choose a subject area to open the module planner and compare catalog
          years with saved plans.
        </p>
        <div className="subject-selection-meta" aria-hidden="true">
          <span>Path planning</span>
          <span>Year comparison</span>
          <span>Saved combinations</span>
        </div>
        <div id="subject-buttons" className="subject-buttons">
          {subjects.map((subject) => (
            <button
              key={subject.id}
              className="subject-button"
              type="button"
              onClick={() => onSelectSubject(subject.id)}
            >
              <span>{subject.name}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
