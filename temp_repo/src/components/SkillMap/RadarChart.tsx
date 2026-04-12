import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { SKILL_CATEGORIES } from '../../constants/skills';

interface RadarChartProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function RadarChart({ users, activeCategories, isDarkMode }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || users.length === 0) return;

    const width = 800;
    const height = 600;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        g.attr('transform', `translate(${width / 2 + event.transform.x}, ${height / 2 + event.transform.y}) scale(${event.transform.k})`);
      });

    svg.call(zoom);

    // Filter categories that have at least one skill
    const categories = SKILL_CATEGORIES.filter(c => activeCategories.includes(c.id as SkillCategory));
    const angleSlice = (Math.PI * 2) / categories.length;
    const radius = 200;

    // Calculate category scores for each user
    const userScores = users.map(user => {
      const scores = categories.map(cat => {
        const catSkills = (user.skillRatings || []).filter(us => us.type === cat.id);
        const totalLevel = catSkills.reduce((sum, s) => sum + s.value, 0);
        // Normalize score to 0-3 range for the radar chart (assuming max 300 per category)
        return Math.min(3, totalLevel / 100);
      });
      return { ...user, scores };
    });

    // Draw axes
    const axis = g.selectAll('.axis')
      .data(categories)
      .enter()
      .append('g')
      .attr('class', 'axis');

    axis.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d, i) => radius * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y2', (d, i) => radius * Math.sin(angleSlice * i - Math.PI / 2))
      .attr('stroke', isDarkMode ? '#444' : '#ccc')
      .attr('stroke-width', 1);

    axis.append('text')
      .attr('x', (d, i) => (radius + 20) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y', (d, i) => (radius + 20) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.color)
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(d => d.name);

    // Draw radar areas
    const radarLine = d3.lineRadial<number>()
      .radius(d => (d / 3) * radius)
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    userScores.forEach(user => {
      g.append('path')
        .datum(user.scores)
        .attr('d', radarLine)
        .attr('fill', user.color)
        .attr('fill-opacity', 0.1)
        .attr('stroke', user.color)
        .attr('stroke-width', 2);
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
