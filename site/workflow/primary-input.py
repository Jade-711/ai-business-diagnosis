import json
import requests_async as requests
MODE = 'diagnosis'

async def main(args: Args) -> Output:
    p = args.params
    context = p.get('context') or {}
    response = await requests.post(
        'https://resource-service.example/api/' + ('workflow-calculate' if MODE == 'diagnosis' else 'workflow-input'),
        headers={'X-Diagnosis-Request': context.get('requestId') or 'demo'},
        json={'context': context, 'question': p.get('question') or '', 'mode': MODE},
        timeout=25,
    )
    payload = response.json()
    if response.status_code != 200:
        raise Exception(payload.get('error') or '本次诊断资料未能读取')
    if MODE == 'diagnosis':
        return {'calculationJson': payload['calculationJson'], 'materials': payload['materials']}
    return {'result': payload['result']}
