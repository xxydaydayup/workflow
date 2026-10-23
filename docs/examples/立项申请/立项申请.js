// 后端根据`./立项申请.bpmn`倒推出来前端需要传给后端的JSON
const project_approval_json = {
  processId: 'project-approval',
  processName: '立项审批',
  nodes: [
    { id: 'start', type: 'start', name: '发起', x: 100, y: 165 },
    { id: 'apply', type: 'approval', name: '立项审批单', x: 180, y: 145 },
    { id: 'minister', type: 'approval', name: '部长审批', x: 340, y: 145 },
    { id: 'gwMinister', type: 'condition', name: '部长审批结果', x: 500, y: 160 },
    {
      id: 'managers',
      type: 'countersign',
      name: '各部门经理会签',
      approveMode: 'ALL',
      x: 600,
      y: 145,
    },
    { id: 'gwManagers', type: 'condition', name: '会签结果', x: 760, y: 160 },
    { id: 'end', type: 'end', name: '结束', x: 860, y: 165 },
  ],
  flows: [
    { source: 'start', target: 'apply' },
    { source: 'apply', target: 'minister' },
    { source: 'minister', target: 'gwMinister' },
    { source: 'gwMinister', target: 'managers', branch: 'pass' },
    { source: 'gwMinister', target: 'apply', branch: 'reject' },
    { source: 'managers', target: 'gwManagers' },
    { source: 'gwManagers', target: 'end', branch: 'pass' },
    { source: 'gwManagers', target: 'apply', branch: 'reject' },
  ],
}

const params_rules = [
  {
    name: 'apply_assignee',
    type: 'String',
    description: '【立项审批单】审批人',
    value: null,
    source: 'start',
    required: true,
  },
  {
    name: 'minister_assignee',
    type: 'String',
    description: '【部长审批】审批人',
    value: null,
    source: 'start',
    required: true,
  },
  {
    name: 'managers_approverList',
    type: 'Array',
    description: '【各部门经理会签】审批人集合',
    value: null,
    source: 'start',
    required: true,
  },
  {
    name: 'minister_approved',
    type: 'Boolean',
    description: '【部长审批】审批结果（true 通过 / false 驳回）',
    value: null,
    source: 'complete',
    required: true,
  },
  {
    name: 'vote',
    type: 'String',
    description: '会签表决：agree 同意 / reject 驳回，完成会签任务时传入',
    value: null,
    source: 'complete',
    required: true,
  },
  {
    name: 'managers_approveMode',
    type: 'String',
    description: '【各部门经理会签】会签审批模式（流程定义已固化，无需传入）',
    value: 'ALL',
    source: 'engine',
    required: false,
  },
]

// 用户启动流程接口传参，给流程引擎的全局变量
const start_payload = {
  businessKey: 'LEAVE-20261021-002',
  parentBusinessKey: '',
  predecessorConstraint: false,
  taskKey: 'project-approval',
  variables: {
    apply_assignee: 'demo',
    minister_assignee: 'buzhang',
    managers_approverList: ['user1', 'user2'],
  },
}
