import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { PREDEFINED_SKILLS, SKILL_CATEGORIES } from '../../constants/skills';

interface BubbleChartProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function BubbleChart({ users, activeCategories, isDarkMode }: BubbleChartProps) {
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

    const skillNodes = Array.from(allSkillsMap.values()).map(s => ({
      ...s,
      skill: { name: s.skillName, category: s.type },
      radius: 10 + s.owners.length * 5 + s.level * 2,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100
    }));

    // Force simulation
    const simulation = d3.forceSimulation(skillNodes as any)
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('charge', d3.forceManyBody().strength(50))
      .force('collide', d3.forceCollide().radius(d => (d as any).radius + 4))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const nodes = g.selectAll('.node')
      .data(skillNodes)
      .enter()
      .append('g')
      .attr('class', 'node');

    nodes.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const cat = SKILL_CATEGORIES.find(c => c.id === d.skill.category);
        return cat ? cat.color : '#ccc';
      })
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => d.owners.length > 1 ? '#fff' : 'none')
      .attr('stroke-width', 2);

    nodes.append('text')
      .attr('dy', '.3em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('font-size', d => Math.max(8, d.radius / 3) + 'px')
      .attr('pointer-events', 'none')
      .text(d => d.skill.name.length > 10 ? d.skill.name.substring(0, 8) + '...' : d.skill.name);

    simulation.on('tick', () => {
      nodes.attr('transform', d => `translate(${(d as any).x}, ${(d as any).y})`);
    });

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

    nodes
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
