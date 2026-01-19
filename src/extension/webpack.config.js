const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'work-item-action': './src/work-item-action/work-item-action.ts',
    dialog: './src/dialog/dialog.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/work-item-action/work-item-action.html',
      filename: 'work-item-action.html',
      chunks: ['work-item-action']
    }),
    new HtmlWebpackPlugin({
      template: './src/dialog/dialog.html',
      filename: 'dialog.html',
      chunks: ['dialog']
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'images', to: 'images' }
      ]
    })
  ],
  devtool: 'source-map'
};
