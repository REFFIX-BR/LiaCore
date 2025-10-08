import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect when user is authenticated
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(username, password);
      // Don't redirect here - useEffect will handle it when user is set
    } catch (err: any) {
      setError(err?.message || "Usuário ou senha inválidos");
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await apiRequest("/api/auth/register", "POST", {
        username,
        password,
        fullName,
        email,
        requestedRole: "AGENT"
      });

      setSuccess("Solicitação enviada com sucesso! Aguarde aprovação de um administrador ou supervisor.");
      
      // Clear form
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      
      toast({
        title: "Solicitação enviada",
        description: "Seu pedido de registro foi enviado para aprovação.",
      });

      // Switch back to login after 3 seconds
      setTimeout(() => {
        setMode("login");
        setSuccess("");
      }, 3000);

    } catch (err: any) {
      setError(err?.message || "Erro ao enviar solicitação de registro");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setSuccess("");
    setUsername("");
    setPassword("");
    setFullName("");
    setEmail("");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">LIA CORTEX</CardTitle>
          <CardDescription className="text-center">
            {mode === "login" 
              ? "Sistema de Orquestração de Atendimento"
              : "Criar Nova Conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                />
              </div>

              <Button
                type="submit"
                data-testid="button-login"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={toggleMode}
                  data-testid="button-toggle-register"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Não tem uma conta? <span className="underline">Criar conta</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-500 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reg-fullname">Nome Completo</Label>
                <Input
                  id="reg-fullname"
                  data-testid="input-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Digite seu nome completo"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-username">Usuário</Label>
                <Input
                  id="reg-username"
                  data-testid="input-reg-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">Senha</Label>
                <Input
                  id="reg-password"
                  data-testid="input-reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              </div>

              <Button
                type="submit"
                data-testid="button-register"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Solicitar Registro"}
              </Button>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={toggleMode}
                  data-testid="button-toggle-login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Já tem uma conta? <span className="underline">Fazer login</span>
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
