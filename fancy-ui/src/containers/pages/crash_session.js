import { connect } from 'react-redux';
import CrashSessionPage from '../../components/pages/crash_session.js';

import { saveWorkflow } from '../../actions/workflows.js';

const mapStateToProps = (state) => {
  return {
    // not used yet, but will be used for automagically saying "no, that name
    // already exists you dummy!"
    workflows: state.workflows.workflows
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onCreateWorkflow(name) {
      const workflow = {
        name,
        meta: null,
        docs: null,
        commands: new Map(),
        diggers: new Map(),
        searchers: new Map(),
        analysis: new Map(),
        bucketing: new Map(),
        decorating: new Map(),
        arranging: new Map()
      };
      dispatch(saveWorkflow(workflow));
    }
  };
};

const ConnectedNewWorkflowPage = connect(
  mapStateToProps,
  mapDispatchToProps
)(NewWorkflowPage);

export default ConnectedNewWorkflowPage;
