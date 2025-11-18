/**
 * Sistema de Logger Condicional
 * 
 * Exibe logs apenas em ambiente de desenvolvimento
 * Suporta níveis: info, warn, error, debug
 */

const isDevelopment = import.meta.env.DEV;

class Logger {
  private static instance: Logger;
  private enabled: boolean;

  private constructor() {
    this.enabled = isDevelopment;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log de informação geral
   */
  public info(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    console.log(`ℹ️ [INFO] ${message}`, ...args);
  }

  /**
   * Log de aviso
   */
  public warn(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    console.warn(`⚠️ [WARN] ${message}`, ...args);
  }

  /**
   * Log de erro
   */
  public error(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    console.error(`❌ [ERROR] ${message}`, ...args);
  }

  /**
   * Log de debug (detalhes técnicos)
   */
  public debug(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    console.debug(`🔍 [DEBUG] ${message}`, ...args);
  }

  /**
   * Log de sucesso (operações bem-sucedidas)
   */
  public success(message: string, ...args: any[]): void {
    if (!this.enabled) return;
    console.log(`✅ [SUCCESS] ${message}`, ...args);
  }

  /**
   * Log de grupo (para agrupar logs relacionados)
   */
  public group(label: string): void {
    if (!this.enabled) return;
    console.group(label);
  }

  public groupEnd(): void {
    if (!this.enabled) return;
    console.groupEnd();
  }

  /**
   * Log de tempo (para medir performance)
   */
  public time(label: string): void {
    if (!this.enabled) return;
    console.time(label);
  }

  public timeEnd(label: string): void {
    if (!this.enabled) return;
    console.timeEnd(label);
  }

  /**
   * Habilita/desabilita logs manualmente (útil para testes)
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Verifica se os logs estão habilitados
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}

// Exporta instância singleton
export const logger = Logger.getInstance();

// Exporta também como default para flexibilidade
export default logger;
