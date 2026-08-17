export type Role = 'Ancião' | 'Servo Ministerial' | 'Publicador';

export type WeekType = 
  | 'Normal' 
  | 'Visita do SC (Semana)';

export interface Brother {
  id: string;
  name: string;
  role: Role;
}

export interface CongregationSettings {
  name: string;
  defaultTime: string; // e.g. "19:30"
  presidentName: string;
  weekType: WeekType;
  brothers: Brother[];
  importedWeekLabel?: string;
}

export interface MeetingPart {
  id: string;
  title: string;
  partNumber?: number; // Número oficial da parte conforme aparece no PDF/Apostila (1, 2, 3, etc.) ou undefined se for cântico/comentários
  plannedTime: number; // in minutes
  flexible: boolean; // if true, can be reduced to absorb delays
  hasCounsel: boolean; // if true, adds a 1-min counsel block after
  supportsAssistant?: boolean; // if true, shows an assistant selector
  hideSpeaker?: boolean; // if true, hides the speaker selector
  speaker?: string;
  assistant?: string;
}

export type PartResultStatus = 'No tempo correto' | 'Excedido' | 'No tempo' | 'Abaixo do tempo';

export interface PartRecord {
  id: string;
  title: string;
  partNumber?: number; // Número oficial da parte conforme aparece no PDF/Apostila
  speaker?: string;
  assistant?: string;
  hideSpeaker?: boolean;
  plannedTime: number; // in minutes
  actualTime: number; // in seconds
  status: PartResultStatus;
  hasCounsel: boolean;
  counselRecorded?: boolean;
}

export interface CompletedMeeting {
  id: string;
  status: 'encerrada';
  encerrada_em: string;
  iniciada_em: string;
  data_formatada: string;
  semana_apostila?: string;
  data_reuniao_curta?: string;
  congregacao: string;
  presidente: string;
  tipo_semana: WeekType;
  duracao_planejada_minutos: number;
  duracao_real_minutos: number;
  duracao_real_segundos: number;
  saldo_final_segundos: number;
  saldo_final_minutos: number;
  indice_final_percentual: number;
  partes: PartRecord[];
}

export interface ActiveMeetingSession {
  status: 'running';
  iniciada_em: string;
  presidente: string;
  tipo_semana: WeekType;
  congregacao: string;
  importedWeekLabel?: string;
  parts: MeetingPart[];
  currentPartIndex: number;
  isCounselPhase: boolean;
  timeBalance: number; // in seconds (+ = atrasado/amber, - = adiantado/blue)
  currentTimerSeconds: number;
  targetDurationSeconds: number;
  isTimerRunning: boolean;
  totalElapsedSeconds: number;
  records: PartRecord[];
}

export interface MeetingState {
  status: 'setup' | 'running' | 'summary' | 'history_list';
  parts: MeetingPart[];
  currentPartIndex: number;
  isCounselPhase: boolean;
  timeBalance: number; // in seconds
  startTime?: Date;
  totalElapsedSeconds: number;
  currentMeeting?: CompletedMeeting;
  history: PartRecord[];
  importedWeekLabel?: string;
}

const rawBrothers = [
  "Adriana Franzi", "Davi Franzi", "Alberto Correia", "Alison Valença", "Alvina", "Ana Leticia", "Ana Paula", 
  "Antonia", "Arlan Cardoso", "Arnon Vinicius", "Beatriz", "Cicera", "Cláudia Nonis", "Cleonice Souza", "Cleuza", 
  "Cristiane", "Denis Nonis", "Denise", "Dionisio", "Djanira", "Edna", "Edson De Souza", "Elaine Ferreira", 
  "Elenilde F. Felix", "Eliane Silva", "Eliezer", "Emerson S. Machado", "Erica Santos", "Eunice Silveira", 
  "Eunice Félix", "Fabiano dos Santos", "Fabio Jose", "Fabricio Gonçalves", "Fatima Dourado", "Fernanda Rodrigues", 
  "Franciele", "Francisca Cavalcante", "Francisca dos Santos", "Germite Oliveira", "Gerson José da Costa", 
  "Gilvaneide dos Santos", "Guilherme Santos", "Gustavo Valença", "Henrique Torres", "Ingrid", "Israel Rezende", 
  "Israelita", "Itallo Silva", "Jair Sampaio", "Jakeline", "Jessica", "Jilmar Silva", "João Junior", 
  "Joelma S. Gonçalves", "Jonathan", "José Carlos", "José Lopes", "George Lucas", "José Marcos", "Julia Oliveira", 
  "Katia Souza", "Kelly Andrade", "Leonardo Silva", "Leticia Gonçalves", "Lorhany Alves", "Lourdes Lindomar", 
  "Lourdes Silva", "Lucas Taveira", "Luciana Santos", "Luciano Taveira", "Lucidalva Santos", "Lucimar Rezende", 
  "Lucineide Torres", "Magno Lobo", "Marcelo Alves", "Marcia Andreia", "Marcia Brito", "Marcia Melo", 
  "Marcio José", "Maria Arlete", "Maria Cícera Espíndola", "Maria Cirilo", "Maria da Graça", "Maria do Carmo", 
  "Maria do Socorro", "Maria Flauzina", "Maria Rosa", "Mércia", "Mércia Moraes", "Micaelle Dauane", "Milena Souza", 
  "Patricia Alves", "Rafael Oliveira", "Raphael Alves", "Raquel Taveira", "Rosemeire Barion", "Sabrina Maysa", 
  "Sônia Menezes", "Stephanie T. Santos", "Terezinha P. Soares", "Thamiris de Souza", "Tiffany Silva", 
  "Valdemir Silva", "Valdir Ferreira", "Vandeir Moraes", "Vanessa F. Silva", "Victor Ferreira", "Victor Ramos", 
  "Viviane S. Barros", "Willian Jezrel"
].sort();

export const DEFAULT_BROTHERS: Brother[] = rawBrothers.map((name, index) => ({
  id: `br-${index}`,
  name,
  role: name.includes('Silva') || name.includes('Ferreira') || name.includes('Moraes') ? 'Ancião' : 'Publicador'
}));

// Meio de Semana Normal (Padrão 105 min - Numeração oficial da Apostila / PDF)
export const DEFAULT_PARTS_NORMAL: MeetingPart[] = [
  { id: "abertura", title: "Cântico e Oração Iniciais", plannedTime: 5, flexible: false, hasCounsel: false, hideSpeaker: false },
  { id: "comentarios", title: "Comentários Iniciais", plannedTime: 1, flexible: false, hasCounsel: false },
  { id: "discurso", partNumber: 1, title: "Tesouros: Discurso", plannedTime: 10, flexible: false, hasCounsel: false },
  { id: "joias", partNumber: 2, title: "Tesouros: Joias Espirituais", plannedTime: 10, flexible: false, hasCounsel: false },
  { id: "leitura", partNumber: 3, title: "Tesouros: Leitura da Bíblia", plannedTime: 4, flexible: false, hasCounsel: true },
  { id: "ministerio1", partNumber: 4, title: "Ministério: Parte 1", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "ministerio2", partNumber: 5, title: "Ministério: Parte 2", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "ministerio3", partNumber: 6, title: "Ministério: Parte 3", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "vida_cantico", title: "Cântico Intermediário", plannedTime: 5, flexible: false, hasCounsel: false, hideSpeaker: true },
  { id: "vida1", partNumber: 7, title: "Nossa Vida Cristã: Parte 1", plannedTime: 15, flexible: false, hasCounsel: false },
  { id: "estudo", partNumber: 8, title: "Estudo Bíblico de Congregação", plannedTime: 30, flexible: true, hasCounsel: false, supportsAssistant: true },
  { id: "comentarios_finais", title: "Comentários Finais", plannedTime: 3, flexible: true, hasCounsel: false },
  { id: "conclusao_cantico", title: "Cântico e Oração Finais", plannedTime: 6, flexible: false, hasCounsel: false, hideSpeaker: false }
];

// Meio de Semana com Visita do Superintendente: Discurso do Super no lugar do livro final (105 min)
export const DEFAULT_PARTS_SC_MIDWEEK: MeetingPart[] = [
  { id: "abertura", title: "Cântico e Oração Iniciais", plannedTime: 5, flexible: false, hasCounsel: false, hideSpeaker: false },
  { id: "comentarios", title: "Comentários Iniciais", plannedTime: 1, flexible: false, hasCounsel: false },
  { id: "discurso", partNumber: 1, title: "Tesouros: Discurso", plannedTime: 10, flexible: false, hasCounsel: false },
  { id: "joias", partNumber: 2, title: "Tesouros: Joias Espirituais", plannedTime: 10, flexible: false, hasCounsel: false },
  { id: "leitura", partNumber: 3, title: "Tesouros: Leitura da Bíblia", plannedTime: 4, flexible: false, hasCounsel: true },
  { id: "ministerio1", partNumber: 4, title: "Ministério: Parte 1", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "ministerio2", partNumber: 5, title: "Ministério: Parte 2", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "ministerio3", partNumber: 6, title: "Ministério: Parte 3", plannedTime: 4, flexible: false, hasCounsel: true, supportsAssistant: true },
  { id: "vida_cantico", title: "Cântico Intermediário", plannedTime: 5, flexible: false, hasCounsel: false, hideSpeaker: true },
  { id: "vida1", partNumber: 7, title: "Nossa Vida Cristã: Parte 1", plannedTime: 15, flexible: false, hasCounsel: false },
  { id: "discurso_sc", partNumber: 8, title: "Discurso de Serviço do Superintendente de Circuito", plannedTime: 30, flexible: true, hasCounsel: false, speaker: "Superintendente de Circuito" },
  { id: "comentarios_finais", title: "Comentários Finais", plannedTime: 3, flexible: true, hasCounsel: false },
  { id: "conclusao_cantico", title: "Cântico e Oração Finais (Oração pelo SC)", plannedTime: 6, flexible: false, hasCounsel: false, speaker: "Superintendente de Circuito" }
];

export const DEFAULT_PARTS = DEFAULT_PARTS_NORMAL;

export function getPartsForWeekType(weekType: WeekType): MeetingPart[] {
  switch (weekType) {
    case 'Visita do SC (Semana)':
      return JSON.parse(JSON.stringify(DEFAULT_PARTS_SC_MIDWEEK));
    case 'Normal':
    default:
      return JSON.parse(JSON.stringify(DEFAULT_PARTS_NORMAL));
  }
}

export const TOTAL_PLANNED_MEETING_MINUTES = 105; // Padrão S-38-T (105 min / 1h 45m)

