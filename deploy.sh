#!/bin/bash

# ==========================================
# HealthLinkConnect - Script de Deploy
# ==========================================
# Este script automatiza o deploy da aplicação em Docker
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Opções:
#   ./deploy.sh --rebuild    # Força rebuild das imagens
#   ./deploy.sh --stop       # Para todos os containers
#   ./deploy.sh --logs       # Mostra logs
#   ./deploy.sh --status     # Mostra status dos containers
# ==========================================

set -e  # Para na primeira erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detectar comando docker-compose
detect_docker_compose() {
    # Tentar docker compose (plugin - versão mais recente)
    if docker compose version >/dev/null 2>&1; then
        DOCKER_COMPOSE_CMD="docker compose"
        return 0
    fi
    
    # Tentar docker-compose (standalone)
    if command_exists docker-compose; then
        DOCKER_COMPOSE_CMD="docker-compose"
        return 0
    fi
    
    return 1
}

# Verificar pré-requisitos
check_prerequisites() {
    print_info "Verificando pré-requisitos..."
    
    if ! command_exists docker; then
        print_error "Docker não está instalado!"
        echo "Instale Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! detect_docker_compose; then
        print_error "Docker Compose não está instalado!"
        echo ""
        echo "Opções de instalação:"
        echo "  1. Docker Compose Plugin (recomendado):"
        echo "     https://docs.docker.com/compose/install/linux/"
        echo ""
        echo "  2. Docker Compose Standalone:"
        echo "     https://docs.docker.com/compose/install/standalone/"
        exit 1
    fi
    
    print_success "Docker encontrado"
    print_success "Docker Compose encontrado: $DOCKER_COMPOSE_CMD"
}

# Verificar arquivo .env
check_env_file() {
    print_info "Verificando arquivo .env..."
    
    if [ ! -f .env ]; then
        print_warning "Arquivo .env não encontrado!"
        
        if [ -f env.example ]; then
            print_info "Copiando env.example para .env..."
            cp env.example .env
            print_warning "⚠️  IMPORTANTE: Edite o arquivo .env com suas configurações antes de continuar!"
            echo ""
            read -p "Pressione ENTER após editar o .env, ou Ctrl+C para cancelar..."
        else
            print_error "Arquivo env.example não encontrado!"
            exit 1
        fi
    else
        print_success "Arquivo .env encontrado"
    fi
}

# Verificar variáveis obrigatórias
check_required_vars() {
    print_info "Verificando variáveis obrigatórias..."
    
    source .env 2>/dev/null || true
    
    local missing_vars=()
    
    if [ -z "$DATABASE_URL" ] && [ -z "$POSTGRES_USER" ]; then
        missing_vars+=("DATABASE_URL")
    fi
    
    if [ -z "$OPENAI_API_KEY" ]; then
        missing_vars+=("OPENAI_API_KEY")
    fi
    
    if [ -z "$UPSTASH_VECTOR_URL" ] || [ -z "$UPSTASH_VECTOR_TOKEN" ]; then
        missing_vars+=("UPSTASH_VECTOR_URL ou UPSTASH_VECTOR_TOKEN")
    fi
    
    if [ -z "$SESSION_SECRET" ]; then
        missing_vars+=("SESSION_SECRET")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_warning "Algumas variáveis podem estar faltando:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        read -p "Deseja continuar mesmo assim? (s/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            exit 1
        fi
    else
        print_success "Variáveis obrigatórias verificadas"
    fi
}

# Parar containers existentes
stop_containers() {
    print_info "Parando containers existentes..."
    $DOCKER_COMPOSE_CMD down 2>/dev/null || true
    print_success "Containers parados"
}

# Construir imagens
build_images() {
    local rebuild=$1
    
    print_info "Construindo imagens Docker..."
    
    if [ "$rebuild" = "--rebuild" ] || [ "$rebuild" = "true" ]; then
        print_info "Forçando rebuild completo (sem cache)..."
        $DOCKER_COMPOSE_CMD build --no-cache
    else
        $DOCKER_COMPOSE_CMD build
    fi
    
    print_success "Imagens construídas com sucesso"
}

# Iniciar serviços
start_services() {
    print_info "Iniciando serviços..."
    
    $DOCKER_COMPOSE_CMD up -d
    
    print_success "Serviços iniciados"
}

# Aguardar serviços ficarem prontos
wait_for_services() {
    print_info "Aguardando serviços ficarem prontos..."
    
    local max_attempts=30
    local attempt=0
    
    # Aguardar PostgreSQL
    print_info "Aguardando PostgreSQL..."
    while [ $attempt -lt $max_attempts ]; do
        if $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            print_success "PostgreSQL está pronto"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "PostgreSQL não ficou pronto a tempo"
        return 1
    fi
    
    # Aguardar Redis
    print_info "Aguardando Redis..."
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if $DOCKER_COMPOSE_CMD exec -T redis redis-cli ping >/dev/null 2>&1; then
            print_success "Redis está pronto"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Redis não ficou pronto a tempo"
        return 1
    fi
    
    # Aguardar aplicação
    print_info "Aguardando aplicação..."
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:5000/api/health >/dev/null 2>&1; then
            print_success "Aplicação está pronta"
            break
        fi
        attempt=$((attempt + 1))
        sleep 3
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_warning "Aplicação pode não estar totalmente pronta ainda"
        print_info "Verifique os logs: docker-compose logs -f app"
    fi
}

# Aplicar schema do banco
apply_database_schema() {
    print_info "Aplicando schema do banco de dados..."
    
    if $DOCKER_COMPOSE_CMD exec -T app npm run db:push 2>/dev/null; then
        print_success "Schema aplicado com sucesso"
    else
        print_warning "Erro ao aplicar schema (pode já estar aplicado)"
        print_info "Você pode tentar manualmente: $DOCKER_COMPOSE_CMD exec app npm run db:push"
    fi
}

# Mostrar status
show_status() {
    echo ""
    print_info "Status dos containers:"
    $DOCKER_COMPOSE_CMD ps
    
    echo ""
    print_info "Informações de acesso:"
    echo ""
    echo "  🌐 Aplicação Principal:"
    echo "     http://localhost:5000"
    echo ""
    echo "  📊 Adminer (PostgreSQL):"
    echo "     http://localhost:8080"
    echo "     Sistema: PostgreSQL"
    echo "     Servidor: postgres"
    echo "     Usuário: postgres"
    echo "     Senha: lia_dev_2024"
    echo "     Base de dados: lia_cortex_dev"
    echo ""
    echo "  🔴 Redis Commander:"
    echo "     http://localhost:8081"
    echo ""
    echo "  📝 Logs da aplicação:"
    echo "     $DOCKER_COMPOSE_CMD logs -f app"
    echo ""
    echo "  🔍 Health Check:"
    echo "     curl http://localhost:5000/api/health"
    echo ""
}

# Mostrar logs
show_logs() {
    print_info "Mostrando logs (Ctrl+C para sair)..."
    $DOCKER_COMPOSE_CMD logs -f
}

# Função principal de deploy
main_deploy() {
    local rebuild=$1
    
    echo ""
    print_info "=========================================="
    print_info "  HealthLinkConnect - Deploy"
    print_info "=========================================="
    echo ""
    
    check_prerequisites
    check_env_file
    check_required_vars
    
    echo ""
    read -p "Deseja continuar com o deploy? (S/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        print_info "Deploy cancelado"
        exit 0
    fi
    
    echo ""
    stop_containers
    build_images "$rebuild"
    start_services
    wait_for_services
    apply_database_schema
    show_status
    
    echo ""
    print_success "Deploy concluído com sucesso! 🎉"
    echo ""
}

# Inicializar variável global
DOCKER_COMPOSE_CMD=""

# Menu principal
case "${1:-}" in
    --stop)
        detect_docker_compose || exit 1
        print_info "Parando todos os containers..."
        $DOCKER_COMPOSE_CMD down
        print_success "Containers parados"
        ;;
    --logs)
        detect_docker_compose || exit 1
        show_logs
        ;;
    --status)
        detect_docker_compose || exit 1
        show_status
        ;;
    --rebuild)
        main_deploy "--rebuild"
        ;;
    --help|-h)
        echo "HealthLinkConnect - Script de Deploy"
        echo ""
        echo "Uso:"
        echo "  ./deploy.sh              # Deploy normal"
        echo "  ./deploy.sh --rebuild     # Deploy com rebuild completo"
        echo "  ./deploy.sh --stop       # Para todos os containers"
        echo "  ./deploy.sh --logs       # Mostra logs em tempo real"
        echo "  ./deploy.sh --status     # Mostra status dos containers"
        echo "  ./deploy.sh --help       # Mostra esta ajuda"
        echo ""
        ;;
    "")
        main_deploy
        ;;
    *)
        print_error "Opção desconhecida: $1"
        echo "Use --help para ver as opções disponíveis"
        exit 1
        ;;
esac

