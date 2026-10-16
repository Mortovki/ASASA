
import { SkillRating } from '../types/skills';

export interface StudentExportData {
  id: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  studentId: string;
  email: string;
  career: string;
  brigadePeriod: string;
  status: string;
  totalHours: number;
}

export async function exportToGoogleSheets(accessToken: string, students: StudentExportData[]) {
  try {
    // 1. Create a new Spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `Reporte de Prestadores - ${new Date().toLocaleDateString()}`,
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create spreadsheet');
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const firstSheet = spreadsheet.sheets[0];
    const sheetName = firstSheet.properties.title;
    const sheetId = firstSheet.properties.sheetId;

    // 2. Prepare data
    const headers = [
      'ID', 'Nombre', 'Apellido Paterno', 'Apellido Materno', 
      'Matrícula', 'Email', 'Carrera', 'Ciclo', 'Estatus', 'Total Horas'
    ];
    
    const rows = students.map(s => [
      s.id, s.firstName, s.lastNamePaterno, s.lastNameMaterno,
      s.studentId, s.email, s.career, s.brigadePeriod, s.status, s.totalHours
    ]);

    const values = [headers, ...rows];

    // 3. Update values
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A1:J${values.length}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: values,
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('Sheets API Error (Update):', errorData);
      throw new Error(`Failed to populate spreadsheet: ${errorData.error?.message || updateResponse.statusText}`);
    }

    // 4. Formatting (Optional but nice)
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.8 },
                  textFormat: { color: { red: 1, green: 1, blue: 1 }, bold: true }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          }
        ]
      })
    });

    return spreadsheet.spreadsheetUrl;
  } catch (error) {
    console.error('Error exporting to Google Sheets:', error);
    throw error;
  }
}
