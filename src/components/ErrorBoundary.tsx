import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl max-w-lg w-full border border-red-200 dark:border-red-900/30">
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Algo deu errado</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              O aplicativo encontrou um erro e não pôde carregar esta tela. 
              Por favor, recarregue a página ou envie o erro abaixo para o suporte.
            </p>
            <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg overflow-auto max-h-48 text-xs font-mono text-slate-800 dark:text-slate-200 mb-4">
              {this.state.error && this.state.error.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-[#295E9F] hover:bg-[#3474C2] text-white rounded-xl font-medium"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


