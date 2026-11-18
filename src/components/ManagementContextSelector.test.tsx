import { render,screen,waitFor,fireEvent } from '@testing-library/react'
import { MemoryRouter,useLocation } from 'react-router-dom'
import { beforeEach,expect,it,vi } from 'vitest'
import ManagementContextSelector from './ManagementContextSelector'
import { discoverResources } from '../AuthorizedResources'
import { consultAuthorization } from '../authorization'

const churchA='00000000-0000-0000-0000-000000000001',churchB='00000000-0000-0000-0000-000000000002',denied='00000000-0000-0000-0000-000000000003'
vi.mock('../auth',()=>({useAuth:()=>({account:'session'})}))
vi.mock('../church-context',()=>({useDefaultChurch:()=>({ready:true,defaultChurchId:'00000000-0000-0000-0000-000000000001'})}))
vi.mock('../AuthorizedResources',()=>({discoverResources:vi.fn()}))
vi.mock('../authorization',()=>({consultAuthorization:vi.fn()}))
function Location(){return <output aria-label="Destino">{useLocation().pathname}</output>}
beforeEach(()=>{
  vi.mocked(discoverResources).mockResolvedValue([{resourceType:'CHURCH',resourceId:churchA,label:'Igreja A'},{resourceType:'CHURCH',resourceId:churchB,label:'Igreja de outra denominação'},{resourceType:'CHURCH',resourceId:denied,label:'Igreja sem permissão de operação'}])
  vi.mocked(consultAuthorization).mockImplementation(async query=>query.resourceId!==denied)
})
it('oferece somente igrejas autorizadas e troca o contexto sem transportar o ID da entidade',async()=>{
  render(<MemoryRouter initialEntries={[`/tarefas/igrejas/${churchA}/00000000-0000-0000-0000-000000000099`]}><ManagementContextSelector/><Location/></MemoryRouter>)
  const combo=await screen.findByRole('combobox',{name:'Igreja da gestão'})
  expect(screen.queryByRole('option',{name:'Igreja sem permissão de operação'})).not.toBeInTheDocument()
  fireEvent.change(combo,{target:{value:churchB}})
  await waitFor(()=>expect(screen.getByLabelText('Destino')).toHaveTextContent(`/tarefas/igrejas/${churchB}`))
  expect(screen.getByLabelText('Destino')).not.toHaveTextContent('000000000099')
})
it('falha fechada na descoberta e permite tentar novamente sem mostrar opções parciais',async()=>{
  vi.mocked(consultAuthorization).mockRejectedValue(new Error('offline'))
  render(<MemoryRouter initialEntries={['/relatorios']}><ManagementContextSelector/></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('contextos autorizados')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeEnabled()
})
it('mantém criação para quem só pode criar, sem oferecer leitura geral da outra igreja',async()=>{
  vi.mocked(consultAuthorization).mockImplementation(async query=>query.resourceId!==denied&&query.permissionCode==='TASK_CREATE')
  render(<MemoryRouter initialEntries={[`/tarefas/igrejas/${churchA}/nova`]}><ManagementContextSelector/><Location/></MemoryRouter>)
  fireEvent.change(await screen.findByRole('combobox',{name:'Igreja da gestão'}),{target:{value:churchB}})
  await waitFor(()=>expect(screen.getByLabelText('Destino')).toHaveTextContent(`/tarefas/igrejas/${churchB}/nova`))
})
