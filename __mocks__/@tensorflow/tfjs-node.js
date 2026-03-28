/**
 * Mock for @tensorflow/tfjs-node
 * Used for testing without actual TensorFlow.js dependencies
 */

const createMockModel = () => {
  const model = {
    layers: [],
    add: function(layer) {
      this.layers.push(layer);
      return this;
    },
    compile: function() {
      return this;
    },
    fit: function() {
      return Promise.resolve({
        history: {
          loss: [0.5, 0.3, 0.2],
          acc: [0.7, 0.8, 0.9],
          val_loss: [0.6, 0.4, 0.3],
          val_acc: [0.65, 0.75, 0.85]
        }
      });
    },
    predict: function() {
      return {
        data: function() {
          return Promise.resolve(new Float32Array([0.3]));
        },
        dispose: function() {}
      };
    },
    save: function() {
      return Promise.resolve(undefined);
    },
    dispose: function() {}
  };
  return model;
};

const tf = {
  sequential: function() {
    return createMockModel();
  },
  layers: {
    dense: function(config) {
      return { 
        name: 'dense',
        units: config?.units,
        activation: config?.activation,
        inputShape: config?.inputShape,
        kernelInitializer: config?.kernelInitializer,
        kernelRegularizer: config?.kernelRegularizer
      };
    },
    batchNormalization: function() {
      return { 
        name: 'batchNormalization',
        apply: function() {}
      };
    },
    dropout: function(config) {
      return { 
        name: 'dropout',
        rate: config?.rate
      };
    }
  },
  train: {
    adam: function(learningRate) {
      return { 
        name: 'adam',
        learningRate 
      };
    }
  },
  tensor2d: function(data) {
    return {
      data: function() {
        return Promise.resolve(new Float32Array(data[0]));
      },
      dispose: function() {}
    };
  },
  loadLayersModel: function() {
    return Promise.resolve({
      predict: function() {
        return {
          data: function() {
            return Promise.resolve(new Float32Array([0.3]));
          },
          dispose: function() {}
        };
      },
      dispose: function() {}
    });
  },
  regularizers: {
    l2: function(config) {
      return { 
        name: 'l2',
        l2: config?.l2
      };
    }
  }
};

module.exports = tf;
module.exports.default = tf;
