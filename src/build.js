import fs from 'fs';

const chunk1 = fs.readFileSync('src/chunk1.tsx', 'utf-8');
const chunk2 = fs.readFileSync('src/chunk2.tsx', 'utf-8');
const chunk3 = fs.readFileSync('src/chunk3.tsx', 'utf-8');
const chunk4 = fs.readFileSync('src/chunk4.tsx', 'utf-8');
const chunk5 = fs.readFileSync('src/chunk5.tsx', 'utf-8');

fs.writeFileSync('src/App.tsx', chunk1 + chunk2 + chunk3 + chunk4 + chunk5);
