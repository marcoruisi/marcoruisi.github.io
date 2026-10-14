#!/usr/bin/env python3
"""Operator panel used only by the existing mrc.command. Stdlib; no stored tokens."""
import ast,base64,datetime,json,os,pathlib,re,shutil,subprocess,sys,tempfile,urllib.error,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
WORKFLOW='.github/workflows/mrc-crossword-daily.yml'
VARIABLE='MRC_DAILY_ENABLED'
GATE="${{ github.event_name == 'workflow_dispatch' || (github.event_name == 'schedule' && vars.MRC_DAILY_ENABLED == 'true') }}"
FILES=(WORKFLOW,'scripts/build_daily_news_crossword.py','scripts/build_crossword_collection.py',
       'scripts/collect_crossword_news.py','scripts/collect_crossword_history.py','scripts/news_relations.py',
       'assets/games/crossword-fillers.csv','assets/games/topic-sources.csv')

def git(*args,env=None,input=None):
    result=subprocess.run(['git',*args],cwd=ROOT,env=env,input=input,text=True,capture_output=True)
    if result.returncode:raise ValueError('Operazione Git non riuscita: '+args[0]+'. Controlla connessione, autenticazione e permessi del repository.')
    return result.stdout.strip()

def repository():
    remote=git('remote','get-url','origin')
    match=re.fullmatch(r'(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)([\w.-]+/[\w.-]+?)(?:\.git)?/?',remote)
    if not match:raise ValueError('Origin deve essere un URL GitHub HTTPS/SSH senza credenziali incorporate.')
    return match[1]

class GitHub:
    def __init__(self,repo):self.repo=repo;self.token=None
    def auth(self):
        # Reuse an existing GitHub CLI login, otherwise the configured Git credential helper.
        if shutil.which('gh'):
            result=subprocess.run(['gh','auth','token','--hostname','github.com'],capture_output=True,text=True)
            if result.returncode==0 and result.stdout.strip():return result.stdout.strip()
        result=subprocess.run(['git','credential','fill'],cwd=ROOT,input='protocol=https\nhost=github.com\npath='+self.repo+'.git\n\n',text=True,capture_output=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'})
        if result.returncode==0:
            fields=dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
            if fields.get('password'):return fields['password']
        raise ValueError('Autenticazione API GitHub non disponibile. Riusa il tuo account con gh auth login oppure il credential helper Git HTTPS. La sola chiave SSH non autorizza le API; nessun token viene salvato dal pannello.')
    def call(self,path='',method='GET',data=None,missing=False):
        if self.token is None:self.token=self.auth()
        request=urllib.request.Request('https://api.github.com/repos/'+self.repo+path,method=method,
            data=None if data is None else json.dumps(data).encode(),headers={
            'Authorization':'Bearer '+self.token,'Accept':'application/vnd.github+json',
            'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'MRC-local-workflow-panel'})
        try:
            with urllib.request.urlopen(request,timeout=30) as response:
                raw=response.read();return json.loads(raw) if raw else None
        except urllib.error.HTTPError as exc:
            if exc.code==404 and missing:return None
            raise ValueError(f'GitHub HTTP {exc.code}: verifica accesso al repository e permessi Actions / Variables / Contents. Nessuna operazione successiva eseguita.') from None
        except urllib.error.URLError:raise ValueError('GitHub non raggiungibile; stato remoto non verificato.') from None

class Panel:
    def __init__(self,api):
        self.api=api;self.repo=api.repo
        self.branch=api.call()['default_branch']
        if self.branch!='main':raise ValueError('Il flusso locale esistente usa main: branch predefinito diverso, operazione annullata.')
    def remote(self):
        w=self.api.call('/actions/workflows/'+pathlib.Path(WORKFLOW).name)
        obj=self.api.call('/contents/'+WORKFLOW+'?ref='+self.branch)
        text=base64.b64decode(obj['content']).decode()
        return w,text
    def variable(self):
        # Listing successfully distinguishes absence from a permissions-related 404.
        page=1
        while True:
            data=self.api.call('/actions/variables?per_page=100&page='+str(page))
            for item in data['variables']:
                if item['name']==VARIABLE:return item
            if page*100>=data['total_count']:return None
            page+=1
    def set_variable(self,value):
        current=self.variable()
        self.api.call('/actions/variables'+('/'+VARIABLE if current else ''),
                      'PATCH' if current else 'POST',{'name':VARIABLE,'value':'true' if value else 'false'})
    def status(self):
        w,text=self.remote()
        if w['state']!='active':print('Automatico: OFF — workflow GitHub '+w['state']);return False
        if GATE in text and re.search(r'^  schedule:',text,re.M):
            variable=self.variable()
            if variable is None:
                raise ValueError('Stato non determinabile: manca la variabile a livello repository (potrebbe essere ereditata). Usa Disabilita automatico per inizializzarla a OFF.')
            enabled=variable['value'].lower()=='true'
            print('Automatico: '+('ON' if enabled else 'OFF')+' — variabile GitHub '+VARIABLE+'='+variable['value'])
            return enabled
        if "if: ${{ github.event_name == 'workflow_dispatch' }}" in text:
            print('Automatico: OFF — blocco fisso nel workflow remoto. Aggiorna script per renderlo gestibile.');return False
        raise ValueError('Condizione remota non riconosciuta: stato non dichiarato ON/OFF e nessuna modifica effettuata.')
    def automatic(self,enabled):
        w,text=self.remote()
        if GATE not in text or not re.search(r'^  schedule:',text,re.M):raise ValueError('Prima esegui Aggiorna script: il workflow remoto non contiene l’interruttore gestibile.')
        print(f'Repository: {self.repo}\nAutomatico → {"ON" if enabled else "OFF"}. Il lancio manuale resta separato.')
        if enabled and w['state']!='active':print('Verrà anche riabilitato il workflow a livello GitHub.')
        if not confirm():return
        self.set_variable(enabled)
        if enabled and w['state']!='active':self.api.call('/actions/workflows/'+str(w['id'])+'/enable','PUT')
        if self.status()!=enabled:raise ValueError('Lo stato riletto non corrisponde alla richiesta. Controlla GitHub; non viene dichiarato un successo.')
    def run(self):
        w,text=self.remote();inputs=read_inputs(text);values={}
        for name,config in inputs.items():
            hint=' / '.join(config.get('options',[]))
            default=config.get('default','')
            value=input(config.get('description',name)+(' ('+hint+')' if hint else '')+' ['+str(default)+']: ').strip() or str(default)
            if config.get('required')=='true' and not value:raise ValueError('Parametro obbligatorio: '+name)
            if config.get('options') and value not in config['options']:raise ValueError('Valore non ammesso: '+name)
            if name=='issue_date' and value:datetime.date.fromisoformat(value)
            if value:values[name]=value
        print(f'Run MANUALE: {self.repo} / {pathlib.Path(WORKFLOW).name}\nBranch remoto: {self.branch}\nParametri: '+json.dumps(values,ensure_ascii=False)+'\nProduce un’anteprima; non pubblica il sito e non abilita la schedulazione.')
        if w['state']!='active':
            if GATE not in text:raise ValueError('Workflow disabilitato globalmente: aggiorna prima gli script.')
            print('Per il run manuale il workflow sarà riabilitato globalmente, con automatico impostato a OFF.')
        if not confirm():return
        if w['state']!='active':
            self.set_variable(False)
            self.api.call('/actions/workflows/'+str(w['id'])+'/enable','PUT')
        self.api.call('/actions/workflows/'+str(w['id'])+'/dispatches','POST',{'ref':self.branch,'inputs':values})
        print('Richiesta accettata da GitHub (completamento non ancora verificato).\nhttps://github.com/'+self.repo+'/actions/workflows/'+pathlib.Path(WORKFLOW).name)
    def update(self):
        for name in FILES:
            p=ROOT/name
            if not p.is_file() or p.is_symlink():raise ValueError('File necessario assente o symlink: '+name)
        print('Aggiornamento separato su '+self.repo+'/'+self.branch+' dei soli file:\n'+'\n'.join(FILES))
        print('Non include pagine o altri commit locali. Il commit usa [skip ci] e [CF-Pages-Skip].')
        _,remote_text=self.remote()
        legacy_off="if: ${{ github.event_name == 'workflow_dispatch' }}" in remote_text
        if not legacy_off and GATE not in remote_text:raise ValueError('Interruttore remoto non riconosciuto: aggiornamento annullato.')
        print('Il blocco fisso OFF sarà conservato come variabile false; un interruttore già gestibile conserverà il suo stato.')
        if not confirm():return
        if legacy_off or self.variable() is None:self.set_variable(False)
        git('fetch','origin',self.branch)
        base=git('rev-parse','refs/remotes/origin/'+self.branch)
        # Isolated index: no checkout/reset/stash, no existing staged changes or commits included.
        with tempfile.TemporaryDirectory(prefix='mrc-crossword-index-') as temp:
            env={**os.environ,'GIT_INDEX_FILE':str(pathlib.Path(temp)/'index')}
            git('read-tree',base,env=env)
            for name in FILES:
                blob=git('hash-object','-w','--',name)
                git('update-index','--add','--cacheinfo','100644,'+blob+','+name,env=env)
            tree=git('write-tree',env=env)
            if tree==git('rev-parse',base+'^{tree}'):
                print('Gli otto file remoti sono già aggiornati.');return
            names=set(git('diff-tree','--no-commit-id','--name-only','-r',base,tree).splitlines())
            if not names.issubset(FILES):raise ValueError('File estranei nel commit: aggiornamento annullato.')
            commit=git('commit-tree',tree,'-p',base,input='[CF-Pages-Skip] [skip ci] MRC crossword scripts\n')
            # Normal non-force push rejects a concurrent remote update instead of overwriting it.
            git('push','origin',commit+':refs/heads/'+self.branch)
            remote=git('ls-remote','origin','refs/heads/'+self.branch).split()[0]
            if remote!=commit:raise ValueError('Il branch remoto è cambiato: aggiornamento da verificare.')
        print('Aggiornati soltanto i file elencati. Working tree, HEAD e staging locali conservati.')

def scalar(s):
    s=s.strip()
    if s[:1] in ('"',"'"):
        try:return ast.literal_eval(s)
        except (ValueError,SyntaxError):raise ValueError('Valore workflow non supportato; nessun run inviato.')
    return s

def read_inputs(text):
    # Read the actual simple input schema used by this workflow; fail closed on other YAML.
    match=re.search(r'^  workflow_dispatch:\s*\n(.*?)(?=^  \w|^\S|\Z)',text,re.M|re.S)
    if not match:raise ValueError('workflow_dispatch non disponibile.')
    result={};current=None
    for line in match[1].splitlines():
        if not line.strip() or line.lstrip().startswith('#') or line.strip()=='inputs:':continue
        key=re.fullmatch(r'      (\w+):\s*',line)
        if key:current=key[1];result[current]={};continue
        field=re.fullmatch(r'        (description|required|type|default|options):\s*(.*)',line)
        if not field or current is None:raise ValueError('Schema input workflow non supportato; nessun run inviato.')
        value=scalar(field[2]);result[current][field[1]]=ast.literal_eval(field[2]) if field[1]=='options' else value
    return result

def confirm():return input('Confermi? Scrivi SI: ').strip().upper()=='SI'

def main():
    panel=None
    while True:
        print('\nCruciverba del giorno\n1. Aggiorna script\n2. Esegui ora\n3. Verifica stato\n4. Abilita automatico\n5. Disabilita automatico\n0. Indietro')
        choice=input('Scelta: ').strip()
        if choice=='0':return
        if choice not in ('1','2','3','4','5'):continue
        try:
            if panel is None:panel=Panel(GitHub(repository()))
            {'1':panel.update,'2':panel.run,'3':panel.status,'4':lambda:panel.automatic(True),'5':lambda:panel.automatic(False)}[choice]()
        except (ValueError,OSError,KeyError) as exc:print('Operazione interrotta: '+str(exc))
if __name__=='__main__':
    try:main()
    except (EOFError,KeyboardInterrupt):print('\nRitorno al menu principale.')
