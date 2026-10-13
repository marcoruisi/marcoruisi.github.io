#!/usr/bin/env python3
"""Scoped, fail-closed cloud publishing helper. Run only in GitHub Actions.
Uploads validated generated daily JSON to a configured Dropbox project folder, while GitHub Actions
commits ONLY explicitly enumerated crossword JSON assets. The caller handles git.
Requires Dropbox OAuth refresh-token credentials; does not read or change other folders.
"""
import argparse, datetime, json, os, pathlib, urllib.parse, urllib.request, urllib.error, base64

ROOT=pathlib.Path('assets/games/crosswords')

def safe_json(path):
    obj=json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(obj,dict) or not isinstance(obj.get('rows'),int) or not isinstance(obj.get('clues'),(dict,list)):
        raise ValueError('Schema JSON incompleto: '+str(path))
    return obj

def dropbox_token():
    fields={key:os.environ.get(key,'') for key in ('DROPBOX_APP_KEY','DROPBOX_APP_SECRET','DROPBOX_REFRESH_TOKEN')}
    if not all(fields.values()):
        raise ValueError('Configurare DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN')
    credential=base64.b64encode((fields['DROPBOX_APP_KEY']+':'+fields['DROPBOX_APP_SECRET']).encode()).decode()
    body=urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':fields['DROPBOX_REFRESH_TOKEN']}).encode()
    req=urllib.request.Request('https://api.dropboxapi.com/oauth2/token',body,headers={'Authorization':'Basic '+credential,'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req,timeout=30) as resp: return json.load(resp)['access_token']

def ensure_folder(token,folder):
    req=urllib.request.Request('https://api.dropboxapi.com/2/files/create_folder_v2',
        json.dumps({'path':folder,'autorename':False}).encode(),
        headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=30) as resp:json.load(resp)
    except urllib.error.HTTPError as exc:
        payload=exc.read().decode('utf-8','replace')
        if exc.code==409 and 'conflict' in payload:return
        raise RuntimeError('Cannot create Dropbox folder '+folder+': '+payload[:300]) from exc

def upload(token,path,dest):
    data=path.read_bytes()
    req=urllib.request.Request('https://content.dropboxapi.com/2/files/upload',data,headers={
        'Authorization':'Bearer '+token,'Content-Type':'application/octet-stream',
        'Dropbox-API-Arg':json.dumps({'path':dest,'mode':'overwrite','autorename':False,'mute':True})},method='POST')
    with urllib.request.urlopen(req,timeout=50) as resp:json.load(resp)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--date',required=True);ap.add_argument('--upload-dropbox',action='store_true');args=ap.parse_args()
    day=datetime.date.fromisoformat(args.date)
    source=ROOT/'mrc-del-giorno.json';obj=safe_json(source)
    if obj.get('mrcEditorial',{}).get('dailyDate')!=str(day):raise ValueError('Data dello schema diversa dalla data prevista')
    if obj['mrcEditorial'].get('reviewRequired',True):raise ValueError('Revisione editoriale non completata')
    if obj['mrcEditorial'].get('verifiedNewsClues',0)<12:raise ValueError('Insufficienti definizioni di attualita verificate')
    archive=ROOT/'daily';archive.mkdir(exist_ok=True)
    copy=archive/(str(day)+'.json');copy.write_bytes(source.read_bytes())
    indexpath=ROOT/'index.json';manifest=json.loads(indexpath.read_text(encoding='utf-8'))
    games=manifest.get('games',[])
    games=[e for e in games if e.get('file')!=f'daily/{day}.json']
    games.append({'id':'daily-'+str(day),'file':f'daily/{day}.json','title':'Cruciverba del '+day.strftime('%d/%m/%Y'),'language':'it','type':'daily-news-archive','date':str(day)})
    manifest['games']=games
    indexpath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.upload_dropbox:
        token=dropbox_token()
        prefix=os.environ.get('MRC_DROPBOX_PROJECT_PATH','').rstrip('/')
        if not prefix.startswith('/') or prefix=='/' or '..' in prefix.split('/'):
            raise ValueError('MRC_DROPBOX_PROJECT_PATH deve indicare la cartella MRC di Dropbox, ad esempio /mrc/web')
        # Upload last the manifest to avoid listing a crossword not yet stored.
        remote_dir=prefix+'/assets/games/crosswords'
        ensure_folder(token,remote_dir+'/daily')
        for file,remote in [(copy,f'{remote_dir}/daily/{day}.json'),(source,remote_dir+'/mrc-del-giorno.json'),(indexpath,remote_dir+'/index.json')]:upload(token,file,remote)
    print('Prepared scoped daily assets:',str(copy),str(source),str(indexpath))
if __name__=='__main__':main()
