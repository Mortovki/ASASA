import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { PREDEFINED_SKILLS, SKILL_CATEGORIES } from '../../constants/skills';

interface VennDiagramProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function VennDiagram({ users, activeCategories, isDarkMode }: VennDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || users.length === 0) return;

    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Calculate student circle positions
    const radius = 150;
    const centerX = width / 2;
    const centerY = height / 2;
    const studentCircles = users.map((user, i) => {
      const angle = (i / users.length) * 2 * Math.PI - Math.PI / 2;
      return {
        ...user,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        r: 180
      };
    });

    // Draw student circles
    g.selectAll('.student-circle')
      .data(studentCircles)
      .enter()
      .append('circle')
      .attr('class', 'student-circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', 'none')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3);

    // Draw student labels
    g.selectAll('.student-label')
      .data(studentCircles)
      .enter()
      .append('text')
      .attr('class', 'student-label')
      .attr('x', d => {
        const angle = Math.atan2(d.y - centerY, d.x - centerX);
        return d.x + (d.r + 20) * Math.cos(angle);
      })
      .attr('y', d => {
        const angle = Math.atan2(d.y - centerY, d.x - centerX);
        return d.y + (d.r + 20) * Math.sin(angle);
      })
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.color)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d.firstName);

    // Collect all skills and their owners
    const allSkillsMap = new Map<string, { skillName: string; type: string; owners: string[]; level: number }>();
    users.forEach(user => {
      user.skillRatings?.forEach(us => {
        if (activeCategories.includes(us.type as SkillCategory)) {
          if (!allSkillsMap.has(us.name)) {
            allSkillsMap.set(us.name, { skillName: us.name, type: us.type, owners: [], level: 0 });
          }
          const entry = allSkillsMap.get(us.name)!;
          entry.owners.push(user.uid);
          entry.level = Math.max(entry.level, us.value);
        }
      });
    });

    const skills = Array.from(allSkillsMap.values());

    // Position skills based on owners
    const skillNodes = skills.map(s => {
      const ownerCircles = studentCircles.filter(c => s.owners.includes(c.uid));
      const avgX = d3.mean(ownerCircles, d => d.x)!;
      const avgY = d3.mean(ownerCircles, d => d.y)!;
      
      // Add some jitter to avoid overlap
      const jitter = 40;
      return {
        ...s,
        x: avgX + (Math.random() - 0.5) * jitter,
        y: avgY + (Math.random() - 0.5) * jitter,
        skill: { name: s.skillName, category: s.type }
      };
    });

    // Draw skill bubbles
    const skillBubbles = g.selectAll('.skill-bubble')
      .data(skillNodes)
      .enter()
      .append('g')
      .attr('class', 'skill-bubble')
      .attr('transform', d => `translate(${d.x}, ${d.y})`);

    skillBubbles.append('circle')
      .attr('r', d => 6 + d.level * 2)
      .attr('fill', d => {
        const cat = SKILL_CATEGORIES.find(c => c.id === d.skill.category);
        return cat ? cat.color : '#ccc';
      })
      .attr('stroke', d => d.owners.length > 1 ? '#fff' : 'none')
      .attr('stroke-width', 1.5)
      .attr('fill-opacity', 0.8);

    // Tooltips
    const tooltip = d3.select('body').append('div')
      .attr('class', 'skill-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', isDarkMode ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)')
      .style('color', isDarkMode ? '#fff' : '#000')
      .style('padding', '8px 12px')
      .style('border-radius', '8px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.2)')
      .style('z-index', '1000');

    skillBubbles
      .on('mouseover', (event, d) => {
        tooltip.style('visibility', 'visible')
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px;">${d.skill.name}</div>
            <div style="color: #888; font-size: 10px; margin-bottom: 8px;">Nivel ${d.level} • ${d.owners.length} prestadores</div>
            <div style="display: flex; gap: 4px;">
              ${d.owners.map(uid => {
                const user = users.find(u => u.uid === uid);
                return `<div style="width: 8px; h: 8px; border-radius: 50%; background: ${user?.color}"></div>`;
              }).join('')}
            </div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip.style('top', (event.pageY - 10) + 'px')
          .style('left', (event.pageX + 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

  }, [users, activeCategories, isDarkMode]);

  return (
    <svg 
      ref={svgRef} 
      className="w-full h-full cursor-grab active:cursor-grabbing"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid meet"
    />
  );
}
